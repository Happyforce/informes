"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isAdminEmail } from "@/lib/admin-domain";

/**
 * Passwordless login in two steps: email → code. The email we send has both a
 * button (magic link) and the code, so it works whether the person clicks the
 * link or types the code here. Typing the code keeps them in THIS window —
 * which matters for the Claude connector's authorization popup.
 */
export default function EmailCodeLogin({
  title,
  intro,
  footer,
  onSignedIn,
}: {
  title: string;
  intro: React.ReactNode;
  footer?: React.ReactNode;
  onSignedIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Introduce un email válido.");
      return;
    }
    setLoading(true);
    const { error } = await createClient().auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        // Client members are never auto-created here: their account is made
        // when an admin grants access. Admins (@myhappyforce.com) are never
        // invited anywhere, so they must be able to self-serve.
        shouldCreateUser: isAdminEmail(trimmed),
      },
    });
    setLoading(false);
    if (error) {
      setError(
        /rate|too many|seconds/i.test(error.message)
          ? "Has pedido varios códigos seguidos. Espera un minuto y vuelve a intentarlo."
          : "No se pudo enviar el email. Comprueba la dirección e inténtalo de nuevo."
      );
      return;
    }
    setEmail(trimmed);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = code.replace(/\D/g, "");
    if (token.length < 6) {
      setError("Escribe el código completo que te hemos enviado.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    let { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) {
      // Accounts not yet confirmed get the "Confirm signup" email: its code
      // verifies as a signup OTP.
      ({ error } = await supabase.auth.verifyOtp({ email, token, type: "signup" }));
    }
    setLoading(false);
    if (error) {
      setError("El código no es correcto o ha caducado. Revísalo o pide uno nuevo.");
      return;
    }
    onSignedIn();
  }

  const errorBox = error && (
    <div className="form-error" role="alert" style={{ marginBottom: 18 }}>
      {error}
    </div>
  );

  if (step === "code") {
    return (
      <form className="auth-card" onSubmit={verify}>
        <div className="sent-icon">✉️</div>
        <h1 style={{ textAlign: "center" }}>Revisa tu correo</h1>
        <p className="sub" style={{ textAlign: "center" }}>
          Te hemos enviado un código a
          <br />
          <b style={{ color: "var(--ink)" }}>{email}</b>
        </p>
        {errorBox}
        <div className="field">
          <label htmlFor="otp">Código</label>
          <input
            id="otp"
            className="input otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={10}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <button className="btn btn-accent btn-block" disabled={loading}>
          {loading ? "Comprobando…" : "Entrar"}
        </button>
        <p className="hint" style={{ textAlign: "center" }}>
          También puedes pulsar el botón del email. Si no llega, revisa el spam.
        </p>
        <p className="hint" style={{ textAlign: "center" }}>
          <a
            style={{ cursor: "pointer" }}
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            ← Usar otro email o pedir un código nuevo
          </a>
        </p>
      </form>
    );
  }

  return (
    <form className="auth-card" onSubmit={sendCode}>
      <h1>{title}</h1>
      <p className="sub">{intro}</p>
      {errorBox}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          className="input"
          type="email"
          placeholder="tu.nombre@empresa.com"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button className="btn btn-accent btn-block" disabled={loading}>
        {loading ? "Enviando…" : "Enviarme el código"}
      </button>
      {footer && <p className="hint">{footer}</p>}
    </form>
  );
}
