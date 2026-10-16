import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const publishableKey = Deno.env.get("PUBLIC_KEY")!;
const privateKey = Deno.env.get("SERVICE_ROLE_KEY")!;

//cliente privilegiado
const admin = createClient(url, privateKey, {
    auth: {persistSession: false, autoRefreshToken: false}
});

const authClient = createClient(url, publishableKey, {
    auth: {persistSession: false, autoRefreshToken: false}
});

const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": 
     "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
}

function response(body: unknown, status = 200){
    return new Response(JSON.stringify(body), {
        status,
        headers: {...cors, "Content-Type": "application/json"}
    });
}

async function internalEmail(username: string):Promise<string> {
    const bytes = new TextEncoder().encode(username.toLocaleLowerCase());
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

    //Identificador de retorno. El usuario no lo conocera
    return `u-${hex}@usuarios.example.com`;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS"){
        return new Response("ok", {headers: cors})
    }

    const path = new URL(req.url).pathname.replace(/\/+$/,"");

    try {
        //POST /Usuarios/registro
        if(path.endsWith("/registro") && req.method === "POST"){
            const body = await req.json();
            const username = 
             typeof body.nombre_usuario === "string"
             ? body.nombre_usuario.trim().toLowerCase()
             : "";
            const password = body.password;
            const idSucursal = body.id_sucursal;

            if (!/^[a-z0-9._-]{3,32}$/.test(username)){
                return response({
                    error: "El nombre de usuario debe de tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.",
                }, 400);
            }

            if(typeof password !== "string" || password.length < 8){
                return response({
                    error: "La contraseña debe de tener al menos 8 caracteres.",
                }, 400);
            }

            if(!Number.isSafeInteger(idSucursal) || idSucursal <= 0){
                return response({
                    error: "id sucursal debe ser un entero positivo.",
                }, 400);
            }

            //Verificar que exista sucursal.
            const {data:sucursal, error:sucursalError } = await admin
                .from("sucursal")
                .select("id")
                .eq("id", idSucursal)
                .maybeSingle();
            
            if(sucursalError) {
                console.error("Error al validar sucursal: ", sucursalError);
                return response({error: "No se pudo validar la sucursal.",
                    detalle: sucursalError.message,
                    codigo: sucursalError.code,
                }, 500);
            }

            if(!sucursal){
                return response({error: "La sucursal no existe."}, 400);
            }

            //Comprobar que el nombre no este ocupado.
            const {data: existente, error: lookupError} = await admin
                .from("usuario")
                .select("id")
                .eq("nombre_usuario", username)
                .maybeSingle();

            if(lookupError){
                return response({error: "No se pudo validar el usuario."}, 500);
            }

            if(existente){
                return response({error: "El nombre de usuario ya existe."}, 409);
            }

            //Crear identidad en Supabase Auth.
            const email = await internalEmail(username);
            const {data: creado, error: authError} =
             await admin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {nombre_usuario: username},
            });

            if(authError || !creado.user){
                return response({error: "No se pudo crear la cuenta de autenticacion.",    
                },400);
            }

            //Crear perfil de la aplicacion
            const {data:perfil, error:perfilError} = await admin
             .from("usuario")
             .insert({
                nombre_usuario: username,
                es_admin: false,
                id_sucursal: idSucursal,
                auth_user_id: creado.user.id,
            })
            .select("id, nombre_usuario, es_admin, id_sucursal")
            .single();
            
            if(perfilError){
                //Evitar dejar una identidad sin su perfil.
                await admin.auth.admin.deleteUser(creado.user.id);

                if(perfilError.code === "23505"){
                    return response({error: "El nombre de usuario ya existe."}, 409);
                }
                
                return response({
                    error: "No se pudo crear el perfil del usuario."
                }, 500);
            }

            return response({
                mensaje: "Usuario registrado correctamente.",
                usuario: perfil,
            }, 201);
        }

        //POST /usuarios/login
        if(path.endsWith("/login") && req.method === "POST"){
            const body = await req.json();
            const username = 
                typeof body.nombre_usuario === "string"
                    ? body.nombre_usuario.trim().toLowerCase()
                    : "";
            const password = body.password;
            if(!username || typeof password !== "string" || !password){
                return response({
                    error: "Debes enviar nombre de usuario y contraseña"
                }, 400);
            }

            const email = await internalEmail(username);

            const {data: sesion, error: loginError} =
                await authClient.auth.signInWithPassword({
                    email,
                    password,
                });
            if(loginError || !sesion.session){
                return response({
                    error: "Nombre de usuario o contraseña incorrectos."
                }, 401);
            }

            const {data:perfil, error:perfilError} = await admin
                .from("usuario")
                .select("id, nombre_usuario, es_admin, id_sucursal")
                .eq("auth_user_id", sesion.user.id)
                .maybeSingle();
            
            if(perfilError || !perfil){
                return response({
                    error: "No se encontro el perfil del usuario."
                }, 403);
            }

            return response({
                mensaje: "Inicio de sesion exitoso.",
                usuario: perfil,
                access_token: sesion.session.access_token,
                refresh_token: sesion.session.refresh_token,
                token_type: sesion.session.token_type,
                expires_in: sesion.session.expires_in,
            });
        }

        //GET /usuarios/perfil
        if(path.endsWith("/perfil") && req.method === "GET"){
            const authorization = req.headers.get("Authorization");
            const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
            
            if(!token){
                return response({
                    error: "Falta el token Bearer"
                }, 401);
            }
            //Verificar el JWT con supabase Auth
            const { data: authData, error: authError} = await 
            authClient.auth.getUser(token);

            if(authError || !authData.user){
                return response({
                    error: "Token invalido o expirado."
                }, 401);
            }

            const {data: perfil, error: perfilError} = await admin
                .from("usuario")
                .select("id, nombre_usuario, es_admin, id_sucursal")
                .eq("auth_user_id", authData.user.id)
                .maybeSingle();

                if(perfilError || !perfil){
                    return response({
                        error: "No se encontro el perfil"
                    }, 404);
                }

                const {data: sucursal, error:sucursalError} = await admin
                    .from("sucursal")
                    .select("id, nombre_sucursal")
                    .eq("id", perfil.id_sucursal)
                    .single();

                if(sucursalError){
                    return response({
                        error: "No se pudo consultar la sucursal"
                    }, 500);
                }

                return response({
                    usuario:perfil,
                    sucursal,
                });
        }
        return response({
            error:"Ruta no encontrada. Usa /registro, /login o /perfil."
        }, 404);
    } catch {
        return response({ error: "Solicitud invalida."},400);
    }
});