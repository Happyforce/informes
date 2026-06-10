# Informes Happyforce — plataforma

Plataforma de publicación de informes: biblioteca pública + espacios privados
por cliente (magic link) + panel de administración para Customer Advisory.

**Stack:** Next.js (App Router) · Supabase (Auth, Postgres + RLS, Storage) · Vercel.

## Cómo funciona

- Cada informe sigue siendo un **fichero HTML autocontenido** (igual que antes).
  Vive en el bucket privado `reports` de Supabase Storage y se sirve a través de
  `/r/{slug}`, que comprueba permisos vía RLS antes de devolverlo.
- **Informes públicos** (`visibility=public`, sin cliente): salen en la landing `/`.
- **Informes de cliente**: solo los ven los emails dados de alta en
  `client_members` (y cualquier cuenta `@myhappyforce.com`, que es admin).
- **Auth**: magic link por email (Supabase Auth, sin contraseñas). Tras el login,
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

## Puesta en marcha (producción)

1. **Supabase**: crea un proyecto en [supabase.com](https://supabase.com) y ejecuta
   `supabase/migrations/0001_init.sql` en el SQL Editor (crea tablas, RLS y el
   bucket `reports`).
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
  edición, Canva) + `storage_path` del HTML + visibilidad.

La seguridad está en la base de datos (políticas RLS), no en el frontend:
una cuenta solo puede leer las filas de sus clientes; `is_hf_admin()`
(email `@myhappyforce.com` en el JWT) desbloquea la gestión completa.
El bucket de Storage es privado y sin políticas: todo acceso a ficheros pasa
por route handlers / server actions que verifican permisos primero.
