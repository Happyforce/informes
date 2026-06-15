"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Introduce un email válido.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        // Don't auto-create accounts from the login form: that path sends the
        // unbranded "Confirm signup" email. Accounts are created when an admin
        // grants access (inviteUserByEmail), so members already exist here and
        // receive the branded Magic Link template.
        shouldCreateUser: false,
      },
    });
    setLoading(false);
    if (error) {
      setError("No se pudo enviar el enlace. Inténtalo de nuevo en un momento.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="auth-card">
        <div className="sent-icon">✉️</div>
        <h1 style={{ textAlign: "center" }}>Revisa tu correo</h1>
        <p className="sub" style={{ textAlign: "center" }}>
          Hemos enviado un enlace de acceso a
          <br />
          <b style={{ color: "var(--ink)" }}>{email}</b>
        </p>
        <p className="hint" style={{ textAlign: "center" }}>
          El enlace caduca en unos minutos. Si no llega, revisa el spam.
        </p>
        <p className="hint" style={{ textAlign: "center" }}>
          <a style={{ cursor: "pointer" }} onClick={() => setSent(false)}>
            ← Usar otro email
          </a>
        </p>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={sendLink}>
      <h1>Accede a tu espacio</h1>
      <p className="sub">
        Introduce tu email de trabajo y te enviaremos un enlace de acceso. Sin
        contraseñas.
      </p>
      {error && (
        <div
          className="hint"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "11px 13px",
            borderRadius: 8,
            marginBottom: 18,
          }}
        >
          {error}
        </div>
      )}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          className="input"
          type="email"
          placeholder="tu.nombre@empresa.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button className="btn btn-accent btn-block" disabled={loading}>
        {loading ? "Enviando…" : "Enviar enlace de acceso"}
      </button>
      <p className="hint">
        Solo los emails dados de alta por tu equipo de Customer Advisory tienen
        acceso a un espacio privado.
      </p>
    </form>
  );
}
