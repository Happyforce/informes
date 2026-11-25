"use client";

import { useActionState, useState } from "react";
import { createTokenAction } from "../actions";

export function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-block">
      <pre>{text}</pre>
      <button
        type="button"
        className="btn btn-secondary copy-btn"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? "✓ Copiado" : "Copiar"}
      </button>
    </div>
  );
}

/** Creates a personal token and shows it (once) inside ready-to-paste setup. */
export default function TokenForm({ mcpUrl }: { mcpUrl: string }) {
  const [state, formAction, isPending] = useActionState(createTokenAction, null);
  const token = state?.token;

  const claudeCode = `claude mcp add --transport http --scope user informes ${mcpUrl} --header "Authorization: Bearer ${token ?? "TU_TOKEN"}"`;
  const desktopJson = JSON.stringify(
    {
      mcpServers: {
        informes: {
          command: "npx",
          args: ["-y", "mcp-remote", mcpUrl, "--header", "Authorization:${AUTH}"],
          env: { AUTH: `Bearer ${token ?? "TU_TOKEN"}` },
        },
      },
    },
    null,
    2
  );

  return (
    <>
      {!token && (
        <form action={formAction} className="admin-form-inline">
          <input
            className="input"
            name="name"
            placeholder="Nombre del token (p. ej. «Portátil de Marta»)"
            maxLength={60}
          />
          <button className="btn btn-accent" disabled={isPending}>
            {isPending ? "Creando…" : "Crear token"}
          </button>
        </form>
      )}
      {state?.error && (
        <div className="form-error" role="alert">
          ⚠ {state.error}
        </div>
      )}

      {token && (
        <div className="token-reveal">
          <p>
            <b>Este es tu token.</b> Cópialo ahora: por seguridad no volverá a
            mostrarse. Si lo pierdes, revócalo y crea otro.
          </p>
          <CopyBlock text={token} />
        </div>
      )}

      <h3 className="setup-title">Claude Code (terminal o pestaña Code de Claude Desktop)</h3>
      <p className="hint">
        Ejecuta esto una vez en un terminal. Queda disponible en todas tus
        sesiones de Claude Code.
      </p>
      <CopyBlock text={claudeCode} />

      <h3 className="setup-title">Chat de Claude Desktop</h3>
      <p className="hint">
        En Claude Desktop: Ajustes → Desarrollador → Editar configuración, y
        añade esto dentro de <code>claude_desktop_config.json</code> (necesita
        Node.js instalado). Desde el chat puedes consultar espacios, dar
        accesos y publicar enlaces; para subir ficheros usa Claude Code.
      </p>
      <CopyBlock text={desktopJson} />
    </>
  );
}
