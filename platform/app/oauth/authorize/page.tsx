import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, isAdminEmail } from "@/lib/auth";
import { getClient } from "@/lib/oauth";
import { authorizeAction } from "./actions";
import { AuthorizeLogin, SwitchAccount } from "./AuthorizeLogin";

/**
 * OAuth authorization endpoint for the Claude connector. Opens in a popup /
 * browser tab when someone clicks "Connect" in Claude: sign in with an email
 * code (same window), then approve.
 */

export const dynamic = "force-dynamic";

const LOGO =
  "https://myhappyforce.com/wp-content/uploads/2019/12/logo_happyforce_horizontal-1024x269.png";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-brand">
            <Link href="/" aria-label="Informes Happyforce">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO} alt="Happyforce" />
            </Link>
            <span className="divider"></span>
            <span className="label">Conectar con Claude</span>
          </div>
        </div>
      </nav>
      <div className="auth-wrap">{children}</div>
    </>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const clientId = one(sp.client_id);
  const redirectUri = one(sp.redirect_uri);
  const state = one(sp.state);
  const codeChallenge = one(sp.code_challenge);
  const method = one(sp.code_challenge_method) || "S256";

  // Unknown client or redirect URI: never redirect anywhere, just explain.
  const client = await getClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    return (
      <Shell>
        <div className="auth-card">
          <h1>Solicitud no válida</h1>
          <p className="sub">
            Este enlace de conexión no es válido o ha caducado. Vuelve a Claude
            y pulsa «Conectar» otra vez.
          </p>
        </div>
      </Shell>
    );
  }

  if (one(sp.response_type) !== "code" || !codeChallenge || method !== "S256") {
    const u = new URL(redirectUri);
    u.searchParams.set("error", "invalid_request");
    if (state) u.searchParams.set("state", state);
    redirect(u.toString());
  }

  const user = await getUser();
  if (!user?.email) {
    return (
      <Shell>
        <AuthorizeLogin />
      </Shell>
    );
  }

  if (!isAdminEmail(user.email)) {
    return (
      <Shell>
        <div className="auth-card">
          <h1>Cuenta sin permiso</h1>
          <p className="sub">
            Has entrado como <b>{user.email}</b>. Solo las cuentas
            @myhappyforce.com pueden conectar Claude con la plataforma.
          </p>
          <p className="hint">
            <SwitchAccount />
          </p>
        </div>
      </Shell>
    );
  }

  const clientName =
    client.client_name && !/^cliente mcp$/i.test(client.client_name)
      ? client.client_name
      : "Claude";

  return (
    <Shell>
      <form action={authorizeAction} className="auth-card consent-card">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="code_challenge" value={codeChallenge} />
        <div className="sent-icon">✳</div>
        <h1 style={{ textAlign: "center" }}>¿Conectar {clientName}?</h1>
        <p className="sub" style={{ textAlign: "center" }}>
          {clientName} podrá trabajar en Informes Happyforce en tu nombre
          (<b style={{ color: "var(--ink)" }}>{user.email}</b>):
        </p>
        <ul className="consent-list">
          <li>Ver los espacios de cliente, quién tiene acceso y sus informes.</li>
          <li>Crear espacios y publicar o editar informes (HTML, PDF, vídeo, enlaces).</li>
          <li>Dar acceso a personas (les llega el email de Happyforce).</li>
        </ul>
        <p className="hint" style={{ marginBottom: 18 }}>
          No podrá borrar nada. Puedes desconectarlo cuando quieras en{" "}
          <Link href="/admin/claude">/admin/claude</Link>.
        </p>
        <button className="btn btn-accent btn-block" name="decision" value="allow">
          Permitir
        </button>
        <button
          className="btn btn-secondary btn-block"
          name="decision"
          value="deny"
          style={{ marginTop: 8 }}
        >
          Cancelar
        </button>
        <p className="hint" style={{ textAlign: "center" }}>
          ¿No eres tú? <SwitchAccount />
        </p>
      </form>
    </Shell>
  );
}
