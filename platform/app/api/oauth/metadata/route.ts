import { OAUTH_SCOPE } from "@/lib/oauth";
import { json, originOf, preflight } from "@/lib/oauth-http";

// RFC 8414 authorization server metadata.
// Served at /.well-known/oauth-authorization-server (rewrite in next.config).
export function GET(request: Request) {
  const origin = originOf(request);
  return json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [OAUTH_SCOPE],
    service_documentation: `${origin}/admin/claude`,
  });
}

export const OPTIONS = preflight;
