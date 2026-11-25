"use server";

import { redirect } from "next/navigation";
import { getUser, isAdminEmail } from "@/lib/auth";
import { createAuthCode, getClient } from "@/lib/oauth";

function withParams(base: string, params: Record<string, string>) {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

/** The person clicked Permitir / Cancelar on the consent screen. */
export async function authorizeAction(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");

  // Re-validate everything: hidden fields come from the browser.
  const client = await getClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    throw new Error("Solicitud de autorización no válida.");
  }
  if (formData.get("decision") !== "allow") {
    redirect(withParams(redirectUri, { error: "access_denied", state }));
  }
  const user = await getUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    redirect(withParams(redirectUri, { error: "access_denied", state }));
  }
  const code = await createAuthCode({
    clientId,
    email: user.email,
    redirectUri,
    codeChallenge,
  });
  redirect(withParams(redirectUri, { code, state }));
}
