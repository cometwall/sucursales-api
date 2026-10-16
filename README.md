# Supabase Project

Proyecto de [Supabase](https://supabase.com) gestionado con la **Supabase CLI**, que incluye la configuración local del stack (Postgres, Auth, Storage, Realtime, Studio, etc.) y una **Edge Function** escrita en TypeScript para [Deno](https://deno.com).

## 📁 Estructura del proyecto

```
supabase/
├── config.toml                  # Configuración del proyecto Supabase (puertos, esquemas, etc.)
├── functions/
│   └── usuarios/                 # Edge Function "usuarios"
│       ├── index.ts              # Código de la función
│       ├── deno.json             # Import map / dependencias de Deno
│       ├── deno.lock             # Lockfile de dependencias (npm/jsr)
│       └── .npmrc                # Configuración para registros npm privados (opcional)
└── .vscode/
    ├── settings.json             # Habilita el soporte de Deno en VS Code para "functions"
    └── extensions.json           # Recomienda la extensión oficial de Deno
```

## ✅ Requisitos previos

Antes de instalar o ejecutar este proyecto necesitas:

| Herramienta | Para qué se usa | Instalación |
|---|---|---|
| **[Git](https://git-scm.com/)** | Clonar el repositorio | — |
| **[Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)** | Levantar el stack local, enlazar el proyecto, servir y desplegar las Edge Functions | Ver abajo |
| **[Docker Desktop](https://docs.docker.com/desktop/)** | Ejecutar localmente Postgres, Auth, Storage, etc. (el CLI los corre como contenedores) | Descargar e iniciar sesión antes de usar `supabase start` |
| **[Deno CLI](https://deno.com/)** (opcional, recomendado) | Soporte de tipos/IntelliSense en el editor para las Edge Functions (`npm:`/`jsr:` specifiers) | Ver abajo |
| **[VS Code](https://code.visualstudio.com/)** + extensión **Deno** (`denoland.vscode-deno`) (opcional) | Autocompletado y chequeo de tipos en `functions/` | Se recomienda automáticamente al abrir la carpeta (`.vscode/extensions.json`) |

> No necesitas Node.js para este proyecto: las Edge Functions corren sobre Deno, no sobre Node.

## 🚀 Instalación

### 1. Clonar el repositorio

```powershell
git clone <URL_DE_TU_REPOSITORIO>
cd supabase
```

### 2. Instalar la Supabase CLI

En **Windows**, con [Scoop](https://scoop.sh):

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Alternativa (si prefieres usar npm, solo a nivel de proyecto, requiere Node.js 20+):

```powershell
npm install supabase --save-dev
# luego ejecuta los comandos con: npx supabase <comando>
```

Verifica la instalación:

```powershell
supabase --version
```

### 3. (Opcional) Instalar Deno CLI para el editor

Esto habilita el chequeo de tipos/IntelliSense en VS Code para los imports `npm:`/`jsr:` de las funciones:

```powershell
irm https://deno.land/install.ps1 | iex
```

Reinicia VS Code después de instalarlo para que la extensión Deno detecte el binario.

### 4. Iniciar sesión y enlazar tu proyecto de Supabase

```powershell
supabase login
supabase link --project-ref <TU_PROJECT_REF>
```

> Encuentras el `project-ref` en el dashboard de Supabase (Project Settings → General) o ejecutando `supabase projects list`.

### 5. Levantar el stack local

Asegúrate de que **Docker Desktop esté corriendo** y luego:

```powershell
supabase start
```

La primera vez descarga las imágenes de Docker, por lo que puede tardar varios minutos. Al finalizar, el comando muestra las URLs y claves locales (API URL, `anon key`, `service_role key`, Studio URL, etc.). Puedes volver a verlas en cualquier momento con:

```powershell
supabase status
```

### 6. Servir la Edge Function localmente

```powershell
supabase functions serve usuarios
```

La función quedará disponible en:

```
http://127.0.0.1:54321/functions/v1/usuarios
```

El servidor local recarga automáticamente al guardar cambios en `functions/usuarios/index.ts`.

Si tu función necesita variables de entorno/secretos propios (además de las que Supabase inyecta automáticamente: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`), crea un archivo `.env` local (no se sube a Git, ver `.gitignore`) y sírvela así:

```powershell
supabase functions serve usuarios --env-file ./functions/usuarios/.env
```

### 7. Probar la función

```powershell
curl -i --location --request POST "http://127.0.0.1:54321/functions/v1/usuarios" `
  --header "apiKey: <TU_ANON_KEY_LOCAL>" `
  --header "Content-Type: application/json" `
  --data "{}"
```

### 8. Desplegar a producción

```powershell
supabase functions deploy usuarios
```

Si usas secretos/variables de entorno en producción, configúralos antes de invocar la función desplegada:

```powershell
supabase secrets set --env-file ./functions/usuarios/.env
```

## 🧪 Desarrollo

- Las dependencias de la función (`npm:`/`jsr:`) se declaran en [`functions/usuarios/deno.json`](./functions/usuarios/deno.json) y quedan fijadas en `deno.lock`.
- El soporte de Deno en VS Code para esta carpeta está habilitado vía `.vscode/settings.json` (`deno.enablePaths`), por lo que no hace falta configurar nada manualmente al abrir el proyecto.

## 🔒 Notas de seguridad

- Nunca subas archivos `.env` con claves reales, el `service_role key`, ni la carpeta `.temp/` (contiene datos de enlace con tu proyecto remoto). Ambos están excluidos en [`.gitignore`](./.gitignore).
- Usa `supabase secrets set` para gestionar secretos en producción en lugar de hardcodearlos en el código.
