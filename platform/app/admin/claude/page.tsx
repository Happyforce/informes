import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listApiTokens } from "@/lib/api-tokens";
import { listConnections } from "@/lib/oauth";
import { revokeConnectionAction, revokeTokenAction } from "../actions";
import TokenForm, { CopyBlock } from "./TokenForm";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://informes.myhappyforce.com";

function fmt(iso: string | null) {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ClaudePage() {
  const user = await requireAdmin();
  const [connections, tokens] = await Promise.all([
    listConnections(user.email!),
    listApiTokens(user.email!),
  ]);
  const base = SITE_URL.replace(/\/$/, "");
  const mcpUrl = `${base}/api/mcp`;

  return (
    <>
      <header className="admin-head">
        <Link href="/admin" className="admin-back">
          ← Volver al panel
        </Link>
        <h1>Conectar con Claude</h1>
        <p>
          Gestiona los espacios de cliente desde Claude: «sube este vídeo al
          espacio de Sabadell», «da acceso a ana@cliente.com», «¿qué informes
          tiene Acme?».
        </p>
      </header>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Cómo conectarte</h2>
        </div>
        <ol className="steps">
          <li>
            En Claude (Desktop, web o móvil): <b>Ajustes → Conectores</b>,
            busca <b>Informes Happyforce</b> y pulsa <b>Conectar</b>.
          </li>
          <li>
            Se abre esta web: escribe tu email @myhappyforce.com y el código
            que te llega por correo.
          </li>
          <li>
            Pulsa <b>Permitir</b>. Listo: no tendrás que repetirlo. También
            funciona en Claude Code con tu cuenta de la empresa.
          </li>
        </ol>
        <p className="hint">
          Desde el chat, Claude te dará un enlace para arrastrar los ficheros
          (vídeos, PDF, HTML). En Claude Code los sube él directamente.
        </p>
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Tus conexiones ({connections.length})</h2>
        </div>
        {connections.length === 0 ? (
          <p className="hint">Todavía no has conectado Claude.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Aplicación</th>
                <th>Conectado</th>
                <th>Último uso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => (
                <tr key={c.id}>
                  <td>{c.client_name}</td>
                  <td>{fmt(c.created_at)}</td>
                  <td>{fmt(c.last_used_at)}</td>
                  <td style={{ width: 1 }}>
                    <form action={revokeConnectionAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn-danger-link">Desconectar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Para el owner de la organización (una sola vez)</h2>
        </div>
        <p className="hint" style={{ marginBottom: 6 }}>
          En claude.ai: <b>Configuración de la organización → Conectores →
          Añadir conector personalizado</b>. Nombre: <b>Informes Happyforce</b>.
          URL:
        </p>
        <CopyBlock text={mcpUrl} />
        <p className="hint">
          No hace falta client ID ni secreto: cada persona se identifica con su
          email al conectar. La skill <b>informes-happyforce</b> también se
          sube a la organización (Configuración → Capacidades → Skills); la
          versión actual está en{" "}
          <a href="/claude/informes-happyforce.zip">informes-happyforce.zip</a>.
        </p>
      </section>

      <section className="admin-section">
        <details>
          <summary className="advanced-summary">
            Avanzado: token personal ({tokens.length})
          </summary>
          <p className="hint" style={{ margin: "12px 0 14px" }}>
            Solo si usas Claude Code sin la cuenta de la empresa. Cada token
            actúa en tu nombre; revócalo si lo pierdes.
          </p>
          {tokens.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Token</th>
                  <th>Creado</th>
                  <th>Último uso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>
                      <code>{t.token_prefix}…</code>
                    </td>
                    <td>{fmt(t.created_at)}</td>
                    <td>{fmt(t.last_used_at)}</td>
                    <td style={{ width: 1 }}>
                      <form action={revokeTokenAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="btn-danger-link">Revocar</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <TokenForm mcpUrl={mcpUrl} />
        </details>
      </section>
    </>
  );
}
