"use client";

import EmailCodeLogin from "@/components/EmailCodeLogin";

export default function LoginForm() {
  return (
    <EmailCodeLogin
      title="Accede a tu espacio"
      intro="Introduce tu email de trabajo y te enviaremos un código de acceso. Sin contraseñas."
      footer="Solo los emails dados de alta por tu equipo de Customer Advisory tienen acceso a un espacio privado."
      // /login redirects a signed-in user to wherever they belong.
      onSignedIn={() => window.location.assign("/login")}
    />
  );
}
