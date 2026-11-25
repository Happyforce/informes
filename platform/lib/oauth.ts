import "server-only";
import { createHash, randomBytes, randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin-domain";

/**
 * Minimal OAuth 2.1 authorization server for the Claude connector.
 *
 * - Public clients only (PKCE S256, no client secret), registered dynamically
 *   (RFC 7591) by claude.ai / Claude Code when someone clicks "Connect".
 * - Redirect URIs are restricted to Claude's callback and loopback addresses,
 *   so a stranger can't register a client that sends codes elsewhere.
 * - The user authenticates on /oauth/authorize with their Supabase session
 *   (email code) and must be a Happyforce admin email.
 * - Access tokens (hfo_…) last 1 h; refresh tokens (hfr_…) 90 days and rotate
 *   on every use. Only SHA-256 hashes are stored.
 */

const ACCESS_TTL_S = 60 * 60;
const REFRESH_TTL_S = 90 * 24 * 60 * 60;
const CODE_TTL_S = 10 * 60;
export const OAUTH_SCOPE = "informes";

const CLAUDE_CALLBACKS = new Set([
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
]);

export class OAuthError extends Error {
  constructor(
    public code: string,
    description: string,
    public status = 400
  ) {
    super(description);
  }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const randomToken = (prefix: string) => prefix + randomBytes(32).toString("base64url");
const isoIn = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

export function isAllowedRedirectUri(uri: string): boolean {
  if (CLAUDE_CALLBACKS.has(uri)) return true;
  try {
    const u = new URL(uri);
    return (
      u.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}

// ─── Clients ─────────────────────────────────────────────────

export interface OAuthClient {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
}

export async function registerClient(body: Record<string, unknown>) {
  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.map(String)
    : [];
  if (redirectUris.length === 0) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uris is required");
  }
  const bad = redirectUris.find((u) => !isAllowedRedirectUri(u));
  if (bad) {
    throw new OAuthError(
      "invalid_redirect_uri",
      `redirect_uri not allowed: ${bad}. Only Claude's callback and loopback addresses are accepted.`
    );
  }
  const client: OAuthClient = {
    client_id: `hfc_${randomUUID()}`,
    client_name: String(body.client_name ?? "Cliente MCP").slice(0, 100),
    redirect_uris: redirectUris,
  };
  const { error } = await createAdminClient().from("oauth_clients").insert(client);
  if (error) throw new OAuthError("server_error", error.message, 500);
  return {
    ...client,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: OAUTH_SCOPE,
  };
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  if (!clientId) return null;
  const { data } = await createAdminClient()
    .from("oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle<OAuthClient>();
  return data;
}

// ─── Authorization codes ─────────────────────────────────────

export async function createAuthCode(p: {
  clientId: string;
  email: string;
  redirectUri: string;
  codeChallenge: string;
}): Promise<string> {
  const code = randomToken("hfa_");
  const { error } = await createAdminClient()
    .from("oauth_codes")
    .insert({
      code_hash: sha256(code),
      client_id: p.clientId,
      user_email: p.email.toLowerCase(),
      redirect_uri: p.redirectUri,
      code_challenge: p.codeChallenge,
      expires_at: isoIn(CODE_TTL_S),
    });
  if (error) throw new OAuthError("server_error", error.message, 500);
  return code;
}

// ─── Tokens ──────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

function newTokenPair() {
  const access = randomToken("hfo_");
  const refresh = randomToken("hfr_");
  return {
    access,
    refresh,
    columns: {
      access_token_hash: sha256(access),
      access_expires_at: isoIn(ACCESS_TTL_S),
      refresh_token_hash: sha256(refresh),
      refresh_expires_at: isoIn(REFRESH_TTL_S),
    },
  };
}

function tokenResponse(access: string, refresh: string): TokenResponse {
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_S,
    refresh_token: refresh,
    scope: OAUTH_SCOPE,
  };
}

export async function exchangeCode(p: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  if (!p.code || !p.codeVerifier) {
    throw new OAuthError("invalid_request", "code and code_verifier are required");
  }
  const admin = createAdminClient();
  // Claim the code atomically: only an unused, unexpired code updates.
  const { data: row } = await admin
    .from("oauth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", sha256(p.code))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("client_id, user_email, redirect_uri, code_challenge")
    .maybeSingle();
  if (!row) throw new OAuthError("invalid_grant", "Invalid, expired or already used code");
  if (p.clientId && row.client_id !== p.clientId) {
    throw new OAuthError("invalid_grant", "Code was issued to another client");
  }
  if (row.redirect_uri !== p.redirectUri) {
    throw new OAuthError("invalid_grant", "redirect_uri does not match");
  }
  const challenge = createHash("sha256").update(p.codeVerifier).digest("base64url");
  if (challenge !== row.code_challenge) {
    throw new OAuthError("invalid_grant", "PKCE verification failed");
  }
  if (!isAdminEmail(row.user_email)) {
    throw new OAuthError("access_denied", "Account is not a Happyforce admin", 403);
  }

  const pair = newTokenPair();
  const { error } = await admin.from("oauth_grants").insert({
    client_id: row.client_id,
    user_email: row.user_email,
    ...pair.columns,
  });
  if (error) throw new OAuthError("server_error", error.message, 500);
  return tokenResponse(pair.access, pair.refresh);
}

export async function refreshTokens(p: {
  refreshToken: string;
  clientId: string;
}): Promise<TokenResponse> {
  if (!p.refreshToken) throw new OAuthError("invalid_request", "refresh_token is required");
  const admin = createAdminClient();
  const { data: grant } = await admin
    .from("oauth_grants")
    .select("id, client_id, user_email")
    .eq("refresh_token_hash", sha256(p.refreshToken))
    .is("revoked_at", null)
    .gt("refresh_expires_at", new Date().toISOString())
    .maybeSingle();
  if (!grant) throw new OAuthError("invalid_grant", "Invalid, expired or revoked refresh token");
  if (p.clientId && grant.client_id !== p.clientId) {
    throw new OAuthError("invalid_grant", "Refresh token was issued to another client");
  }
  if (!isAdminEmail(grant.user_email)) {
    throw new OAuthError("access_denied", "Account is not a Happyforce admin", 403);
  }
  const pair = newTokenPair();
  // Rotate: the old refresh token stops working.
  const { data: updated } = await admin
    .from("oauth_grants")
    .update(pair.columns)
    .eq("id", grant.id)
    .eq("refresh_token_hash", sha256(p.refreshToken))
    .select("id")
    .maybeSingle();
  if (!updated) throw new OAuthError("invalid_grant", "Refresh token already used");
  return tokenResponse(pair.access, pair.refresh);
}

/** Resolve an OAuth access token (hfo_…) to its owner's email, or null. */
export async function verifyOAuthAccessToken(token: string): Promise<string | null> {
  if (!token.startsWith("hfo_")) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("oauth_grants")
    .select("id, user_email, last_used_at")
    .eq("access_token_hash", sha256(token))
    .is("revoked_at", null)
    .gt("access_expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data || !isAdminEmail(data.user_email)) return null;
  const last = data.last_used_at ? Date.parse(data.last_used_at) : 0;
  if (Date.now() - last > 60_000) {
    await admin
      .from("oauth_grants")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
  }
  return data.user_email;
}

// ─── Connections (for /admin/claude) ─────────────────────────

export interface Connection {
  id: string;
  client_name: string;
  created_at: string;
  last_used_at: string | null;
}

export async function listConnections(email: string): Promise<Connection[]> {
  const { data } = await createAdminClient()
    .from("oauth_grants")
    .select("id, created_at, last_used_at, oauth_clients(client_name)")
    .ilike("user_email", email)
    .is("revoked_at", null)
    .gt("refresh_expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return (data ?? []).map((g) => {
    const c = g.oauth_clients as { client_name: string } | { client_name: string }[] | null;
    return {
      id: g.id,
      created_at: g.created_at,
      last_used_at: g.last_used_at,
      client_name: (Array.isArray(c) ? c[0]?.client_name : c?.client_name) ?? "Claude",
    };
  });
}

export async function revokeConnection(email: string, id: string) {
  const { error } = await createAdminClient()
    .from("oauth_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .ilike("user_email", email);
  if (error) throw new Error(error.message);
}
