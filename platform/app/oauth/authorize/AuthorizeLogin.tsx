"use client";

import EmailCodeLogin from "@/components/EmailCodeLogin";
import { createClient } from "@/lib/supabase/client";

export function AuthorizeLogin() {
  return (
    <EmailCodeLogin
      title="Conecta Claude con Informes"
      intro={
        <>
          Entra con tu email de Happyforce (<b>@myhappyforce.com</b>). Te
          enviaremos un código para escribirlo aquí.
        </>
      }
      // Re-render this same page (same query string) now that there's a session.
      onSignedIn={() => window.location.reload()}
    />
  );
}

export function SwitchAccount() {
  return (
    <a
      style={{ cursor: "pointer" }}
      onClick={async () => {
        await createClient().auth.signOut();
        window.location.reload();
      }}
    >
      Usar otra cuenta
    </a>
  );
}
