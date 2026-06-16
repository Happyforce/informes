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
| **Confirm signup**    | `confirm-signup.html`  | un usuario **sin confirmar** pide un enlace de acceso |

### Por qué importa "Confirm signup"

Supabase decide la plantilla según el estado del usuario en Auth:

- Email **sin cuenta** (y `shouldCreateUser:true`) → **Confirm signup**.
- Usuario que **existe pero está sin confirmar** → **Confirm signup**.
- Usuario que **existe y está confirmado** → **Magic Link**.

Aquí está la trampa: `inviteUserByEmail` (lo que dispara "Dar acceso") crea al
usuario **sin confirmar** — se confirma al pulsar el enlace de la invitación. Si
el cliente **ignora la invitación** y luego pide un magic link en `/login`,
todavía está sin confirmar, así que Supabase le manda **Confirm signup**, no el
Magic Link. Sin brandear, le llega el "Confirm your email address" por defecto
(inglés, sin logo), que confunde. Por eso esta plantilla **tiene que estar
brandeada igualmente**: con `confirm-signup.html` recibe un email de Happyforce y
el botón (token_hash + `type=signup`) le hace entrar igual que un magic link.

## Requisitos para que los enlaces funcionen

1. **Redirect URL** — añade `https://informes.myhappyforce.com/auth/callback`
   (y la URL de cada preview/entorno que uses) en
   *Authentication → URL Configuration → Redirect URLs*. Sin esto Supabase
   rechaza el `redirectTo`.

2. **SMTP propio** — configura un proveedor (Resend, Postmark…) en
   *Authentication → Emails → SMTP Settings*. El SMTP de pruebas de Supabase
   limita el envío a unos pocos correos al día y solo a emails del equipo, así
   que en producción los clientes no recibirían nada.

3. **No cambies el formato del enlace** — el botón de **las tres plantillas**
   apunta a `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=…`
   (`type=invite`, `type=signup` o `type=magiclink` según la plantilla), **no** a
   `{{ .ConfirmationURL }}`. `/auth/callback` espera `token_hash` + `type` y los
   resuelve con `verifyOtp`. Si usas `{{ .ConfirmationURL }}` el enlace sale por el
   flujo implícito y deja el token en el `#hash`, que el callback (server-side) no
   puede leer: redirige a `/login?error=link` y el acceso falla. Le pasó a la
   plantilla **Magic Link**, que dejaba fuera a los admins (que ya existen en Auth
   y reciben siempre esa plantilla).
