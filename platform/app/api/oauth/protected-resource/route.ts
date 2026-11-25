import { OAUTH_SCOPE } from "@/lib/oauth";
import { json, originOf, preflight } from "@/lib/oauth-http";

// RFC 9728 protected resource metadata for the MCP endpoint.
// Served at /.well-known/oauth-protected-resource[/api/mcp] (rewrites).
export function GET(request: Request) {
  const origin = originOf(request);
  return json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: [OAUTH_SCOPE],
    resource_name: "Informes Happyforce",
  });
}

export const OPTIONS = preflight;
