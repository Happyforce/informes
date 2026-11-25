import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Client membership + access emails. Shared by the admin server actions and
// the Claude MCP server; callers must have checked the caller is an admin.

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://informes.myhappyforce.com";

// Already has an Auth account (admins, re-grants, returning clients): they can
// log in via magic link, so there's nothing to send and it isn't an error.
const ALREADY_REGISTERED = /already|registered|exists/i;
// Supabase throttles auth emails; when several invites fire close together the
// later ones come back rate-limited (HTTP 429).
const RATE_LIMITED = /rate limit|too many|over_email_send/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Create the Supabase Auth user and send the branded "Invite user" email.
 * Retries on rate-limit so a burst of "Dar acceso" clicks doesn't leave members
 * stranded without an account. Returns whether the email already had an account
 * (in which case nothing was sent). Throws — leaving any member row in place so
 * it can be recovered with "Reenviar acceso" — when the email can't be sent.
 */
export async function inviteToAuth(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<{ alreadyRegistered: boolean }> {
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${SITE_URL}/auth/callback`,
    });
    if (!error) return { alreadyRegistered: false };
    if (ALREADY_REGISTERED.test(error.message)) {
      return { alreadyRegistered: true };
    }
    lastError = error.message;
    if (!RATE_LIMITED.test(error.message)) break;
    await sleep(5000);
  }
  throw new Error(
    `No se pudo enviar el email de acceso (${lastError}). El acceso queda ` +
      `guardado; espera un momento y pulsa "Reenviar acceso".`
  );
}

/**
 * Give an email access to a client's space and send the branded access email
 * right away. Because the user then exists in Auth, their later logins get the
 * Magic Link template instead of "Confirm signup".
 */
export async function addMember(
  clientId: string,
  rawEmail: string
): Promise<{ email: string; alreadyRegistered: boolean }> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email no válido");

  const admin = createAdminClient();
  const { error } = await admin
    .from("client_members")
    .insert({ client_id: clientId, email });
  if (error && !error.message.includes("duplicate")) {
    throw new Error(error.message);
  }
  const { alreadyRegistered } = await inviteToAuth(admin, email);
  return { email, alreadyRegistered };
}
