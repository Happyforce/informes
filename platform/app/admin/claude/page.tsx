import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listApiTokens } from "@/lib/api-tokens";
import { revokeTokenAction } from "../actions";
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
  const tokens = await listApiTokens(user.email!);
  const base = SITE_URL.replace(/\/$/, "");
  const mcpUrl = `${base}/api/mcp`;
  const skillInstall = `mkdir -p ~/.claude/skills/informes-happyforce && curl -fsSL ${base}/claude/informes-happyforce/SKILL.md -o ~/.claude/skills/informes-happyforce/SKILL.md`;

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
          <h2>Tus tokens ({tokens.length})</h2>
        </div>
        <p className="hint" style={{ marginBottom: 14 }}>
          Cada token actúa en tu nombre con permisos de administrador, y todo lo
          que publique queda registrado a tu nombre. Créalo para cada ordenador
          y revócalo si lo pierdes o ya no lo usas.
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
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Configurar Claude</h2>
        </div>
        <TokenForm mcpUrl={mcpUrl} />
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Skill «informes-happyforce»</h2>
        </div>
        <p className="hint" style={{ marginBottom: 6 }}>
          Enseña a Claude el proceso completo: revisar y comprimir vídeos,
          redactar la tarjeta con el estilo de cada cliente, pedir
          confirmación antes de publicar y dar los enlaces al final. Se activa
          sola cuando pides subir o publicar algo en un espacio de cliente.
        </p>
        <h3 className="setup-title">Claude Code</h3>
        <CopyBlock text={skillInstall} />
        <h3 className="setup-title">Claude Desktop (chat)</h3>
        <p className="hint">
          Descarga <a href="/claude/informes-happyforce.zip">informes-happyforce.zip</a>{" "}
          y súbelo en Ajustes → Capacidades → Skills. Un owner de la
          organización puede subirlo una vez para todo el equipo.
        </p>
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Qué puede hacer Claude</h2>
        </div>
        <ul className="capabilities">
          <li>Ver clientes, quién tiene acceso a cada espacio y qué informes tiene.</li>
          <li>Crear espacios de cliente y dar acceso a personas (les llega el email de Happyforce).</li>
          <li>Subir informes HTML, PDF y vídeos (desde Claude Code) o publicar enlaces externos.</li>
          <li>Editar la tarjeta de un informe o sustituir su fichero.</li>
        </ul>
        <p className="hint">
          Quitar accesos y eliminar informes o clientes sigue haciéndose desde
          este panel.
        </p>
      </section>
    </>
  );
}
