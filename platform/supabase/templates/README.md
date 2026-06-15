# Plantillas de email de Supabase Auth

Estos HTML son las plantillas branded (logo Happyforce, naranja `#f26522`, copy en
español) que hay que pegar en el dashboard de Supabase. El repo es la fuente de
verdad; Supabase no las lee solo, hay que copiarlas a mano cuando cambien.

## Qué plantilla va en cada sitio

Dashboard → **Authentication → Emails**, pestaña por plantilla, campo
*Message body (source)*:

| Plantilla de Supabase | Fichero de este repo   | Cuándo la envía Supabase                          |
| --------------------- | ---------------------- | ------------------------------------------------- |
| **Invite user**       | `invite-user.html`     | `inviteUserByEmail` — al "Dar acceso" en el panel |
| **Magic Link**        | `magic-link.html`      | login de un usuario que **ya existe** en Auth     |
| **Confirm signup**    | brandear (ver abajo)   | login/alta de un email que **aún no existe**      |

### Por qué importa "Confirm signup"

Supabase decide la plantilla según si el email ya tiene cuenta en Auth:

- Usuario **nuevo** (no existe en Auth) → manda **Confirm signup**.
- Usuario **existente** → manda **Magic Link**.

Con este flujo las cuentas se crean al dar acceso (`inviteUserByEmail`), así que
el cliente ya existe en Auth antes de su primer login y recibe **Magic Link**
(branded). Pero **Confirm signup** sigue siendo la red de seguridad: si alguna vez
llega un login de un email que no existe (p. ej. alta manual fuera del panel),
esa es la plantilla que se dispara. Por eso hay que **brandearla también** — si no,
sale la plantilla por defecto de Supabase, sin branding y en inglés, que es
justo el bug que arreglamos. Puedes reutilizar el copy de `invite-user.html`.

## Requisitos para que los enlaces funcionen

1. **Redirect URL** — añade `https://informes.myhappyforce.com/auth/callback`
   (y la URL de cada preview/entorno que uses) en
   *Authentication → URL Configuration → Redirect URLs*. Sin esto Supabase
   rechaza el `redirectTo`.

2. **SMTP propio** — configura un proveedor (Resend, Postmark…) en
   *Authentication → Emails → SMTP Settings*. El SMTP de pruebas de Supabase
   limita el envío a unos pocos correos al día y solo a emails del equipo, así
   que en producción los clientes no recibirían nada.

3. **No cambies el formato del enlace** — el botón de `invite-user.html` apunta a
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite`, **no** a
   `{{ .ConfirmationURL }}`. `/auth/callback` espera `token_hash` + `type` y los
   resuelve con `verifyOtp`. Si cambias a `{{ .ConfirmationURL }}` el enlace deja
   de cuadrar con el callback y el acceso falla.
