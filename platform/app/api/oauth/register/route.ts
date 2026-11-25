import { registerClient } from "@/lib/oauth";
import { json, oauthErrorResponse, preflight } from "@/lib/oauth-http";

// RFC 7591 dynamic client registration (public clients, Claude callbacks and
// loopback redirect URIs only — see isAllowedRedirectUri).
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return json(await registerClient(body), 201);
  } catch (e) {
    return oauthErrorResponse(e);
  }
}

export const OPTIONS = preflight;
