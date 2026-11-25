# Informes Happyforce — plataforma

Plataforma de publicación de informes: biblioteca pública + espacios privados
por cliente (magic link) + panel de administración para Customer Advisory.

**Stack:** Next.js (App Router) · Supabase (Auth, Postgres + RLS, Storage) · Vercel.

## Cómo funciona

- Cada informe sigue siendo un **fichero HTML autocontenido** (igual que antes).
  Vive en el bucket privado `reports` de Supabase Storage y se sirve a través de
  `/r/{slug}`, que comprueba permisos vía RLS antes de devolverlo.
- **Tipos de informe**: HTML autocontenido, PDF, **vídeo** (MP4/WebM/MOV) o
  enlace externo. Los ficheros **no pasan por Vercel** (límite de 4,5 MB por
  petición): el navegador (o Claude) pide una URL de subida firmada y sube el
  fichero directo a Storage (`uploads/<uuid>.<ext>`); al publicar, el servidor
  lo mueve a `<client_id|public>/<slug>-<id>.<ext>`. Al servir, los HTML pasan
  por `/r/{slug}`; los PDF redirigen a una URL firmada de 1 h y los vídeos se
  muestran en una página de reproductor con una URL firmada de 6 h (Storage
  sirve rangos, así que se puede avanzar y funciona en iPhone).
- **Informes públicos** (`visibility=public`, sin cliente): salen en la landing `/`.
- **Informes de cliente**: solo los ven los emails dados de alta en
  `client_members` (y cualquier cuenta `@myhappyforce.com`, que es admin).
- **Auth**: código o enlace por email (Supabase Auth, sin contraseñas). Tras el login,
  cada uno aterriza donde le toca: admin → `/admin`, miembro → `/c/{slug}`,
  email sin espacio → `/sin-acceso`.

## Rutas

| Ruta | Acceso | Qué es |
|---|---|---|
| `/` | público | Landing con los informes públicos |
| `/login` | público | Envío del magic link |
| `/auth/callback` | — | Intercambio del código del magic link |
| `/c/{slug}` | miembros + admins | Espacio privado del cliente |
| `/r/{slug}` | según informe | Visor: sirve el HTML desde Storage |
| `/admin` | @myhappyforce.com | Clientes, informes públicos, subida |
| `/admin/{slug}` | @myhappyforce.com | Detalle de cliente: miembros + informes |
| `/admin/claude` | @myhappyforce.com | Conexiones con Claude, instrucciones y tokens personales |
| `/api/mcp` | OAuth (`hfo_…`) o token `hfi_…` | Servidor MCP del conector de Claude |
| `/oauth/authorize` | @myhappyforce.com | Autorizar el conector (código por email + Permitir) |
| `/subir/{id}` | @myhappyforce.com | Subida de ficheros pedida desde el chat de Claude |

## Claude (conector MCP)

`/api/mcp` es un servidor MCP (Streamable HTTP, sin estado, respuestas JSON)
para que Customer gestione los espacios desde Claude.

**Conector de la organización (lo normal).** El owner lo añade una vez en
claude.ai (Configuración de la organización → Conectores → Añadir conector
personalizado, URL `https://informes.myhappyforce.com/api/mcp`). Cada persona
pulsa «Conectar», entra con su email @myhappyforce.com y un **código por
email** en la misma ventana, y pulsa «Permitir». Por debajo es OAuth 2.1:

- Descubrimiento: `/.well-known/oauth-protected-resource` y
  `/.well-known/oauth-authorization-server` (rewrites en `next.config.mjs`), y
  `WWW-Authenticate` en el 401 de `/api/mcp`.
- Registro dinámico `/api/oauth/register` (solo callbacks de Claude y
  loopback), autorización `/oauth/authorize` (login con código + consentimiento),
  token `/api/oauth/token` (PKCE S256; access 1 h, refresh 90 días rotativo).
- Tablas `oauth_clients`, `oauth_codes`, `oauth_grants` (solo hashes). Cada
  persona ve y desconecta sus conexiones en `/admin/claude`.

**Token personal (avanzado).** `hfi_…` creado en `/admin/claude`, para Claude
Code sin cuenta de empresa (`claude mcp add … --header "Authorization: Bearer …"`).

Herramientas: `list_clients`, `get_client`, `list_public_reports`,
`create_client`, `add_member`, `prepare_upload`, `check_upload`,
`publish_report`, `update_report`. Subir un fichero:
- **Chat (sin terminal):** `prepare_upload` da un enlace `/subir/{id}` donde la
  persona arrastra el fichero (va directo a Storage; para HTML la página extrae
  los datos de la tarjeta y los guarda como metadatos del objeto) →
  `check_upload` → `publish_report`.
- **Claude Code:** `prepare_upload` con `file_name` → `curl -T` a la URL firmada
  → `publish_report`.

Lo destructivo (quitar accesos, borrar informes o clientes) solo desde el
panel. La skill `informes-happyforce` (`public/claude/`) guía el flujo; tras
editarla, `npm run package-skill`.

## Puesta en marcha (producción)

1. **Supabase**: crea un proyecto en [supabase.com](https://supabase.com) y ejecuta
   en orden las migraciones de `supabase/migrations/` en el SQL Editor (crean
   tablas, RLS, el bucket `reports`, el tipo vídeo y los tokens de API).
   **Una migración nueva se aplica a mano antes de desplegar el código que la
   usa.**
2. **Auth**: en Authentication → URL Configuration, añade
   `https://informes.myhappyforce.com/auth/callback` a las Redirect URLs.
   Recomendado: configurar SMTP propio (Resend/Postmark) en Auth → SMTP para
   buena entregabilidad de los magic links.
3. **Variables de entorno**: copia `.env.example` a `.env.local` (local) y
   configura las mismas en Vercel (Settings → Environment Variables).
4. **Migrar los informes actuales**: `npm run migrate-reports` (sube los dos
   HTML del repo raíz y los registra como públicos).
5. **Vercel**: importa el repo, *Root Directory* = `platform/`. Deploy.
6. **DNS**: cambia el CNAME de `informes.myhappyforce.com` de GitHub Pages a
   Vercel (`cname.vercel-dns.com`) y añade el dominio al proyecto de Vercel.
   Las URLs antiguas (`/iv-informe-felicidad-2026.html`, etc.) redirigen solas.

## Desarrollo local

```bash
cd platform
npm install
cp .env.example .env.local   # rellena con tu proyecto Supabase
npm run dev                  # http://localhost:4600
```

## Modelo de datos (resumen)

- `clients` — slug, nombre, color e iniciales del espacio.
- `client_members` — allowlist de emails por cliente.
- `reports` — metadatos de la card (título, descripción, badges, stats, portada,
  edición, Canva) + `kind` (html/pdf/video/link) + `storage_path` o
  `external_url` + visibilidad + `created_by`.
- `api_tokens` — tokens personales del servidor MCP (hash SHA-256, revocables).

La seguridad está en la base de datos (políticas RLS), no en el frontend:
una cuenta solo puede leer las filas de sus clientes; `is_hf_admin()`
(email `@myhappyforce.com` en el JWT) desbloquea la gestión completa.
El bucket de Storage es privado y sin políticas: todo acceso a ficheros pasa
por route handlers / server actions que verifican permisos primero.
