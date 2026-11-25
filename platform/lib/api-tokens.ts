import "server-only";
import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin-domain";

/**
 * Personal access tokens for the Claude MCP server (/api/mcp).
 * Format: hfi_<43 chars base64url>. Only the SHA-256 hash is stored; the
 * token is shown once on creation. A token acts as its owner, and only
 * works while the owner is still a Happyforce admin email.
 */

const PREFIX = "hfi_";

export interface ApiToken {
  id: string;
  user_email: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createApiToken(
  userEmail: string,
  name: string
): Promise<string> {
  const token = PREFIX + randomBytes(32).toString("base64url");
  const { error } = await createAdminClient()
    .from("api_tokens")
    .insert({
      user_email: userEmail.toLowerCase(),
      name: name.trim() || "Claude",
      token_hash: hash(token),
      token_prefix: token.slice(0, PREFIX.length + 6),
    });
  if (error) throw new Error(`No se pudo crear el token: ${error.message}`);
  return token;
}

export async function listApiTokens(userEmail: string): Promise<ApiToken[]> {
  const { data } = await createAdminClient()
    .from("api_tokens")
    .select("id, user_email, name, token_prefix, created_at, last_used_at, revoked_at")
    .ilike("user_email", userEmail)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as ApiToken[];
}

export async function revokeApiToken(userEmail: string, id: string) {
  const { error } = await createAdminClient()
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .ilike("user_email", userEmail);
  if (error) throw new Error(error.message);
}

/** Resolve a bearer token to its owner's email, or null if invalid. */
export async function verifyApiToken(token: string | null): Promise<string | null> {
  if (!token || !token.startsWith(PREFIX)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("api_tokens")
    .select("id, user_email, last_used_at")
    .eq("token_hash", hash(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (!data || !isAdminEmail(data.user_email)) return null;

  // Touch last_used_at at most once a minute.
  const last = data.last_used_at ? Date.parse(data.last_used_at) : 0;
  if (Date.now() - last > 60_000) {
    await admin
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
  }
  return data.user_email;
}
