import { OAuthError, exchangeCode, refreshTokens } from "@/lib/oauth";
import { json, oauthErrorResponse, preflight, readBody } from "@/lib/oauth-http";

// Token endpoint: authorization_code (+PKCE) and refresh_token grants.
export async function POST(request: Request) {
  try {
    const b = await readBody(request);
    if (b.grant_type === "authorization_code") {
      return json(
        await exchangeCode({
          code: b.code ?? "",
          clientId: b.client_id ?? "",
          redirectUri: b.redirect_uri ?? "",
          codeVerifier: b.code_verifier ?? "",
        })
      );
    }
    if (b.grant_type === "refresh_token") {
      return json(
        await refreshTokens({ refreshToken: b.refresh_token ?? "", clientId: b.client_id ?? "" })
      );
    }
    throw new OAuthError("unsupported_grant_type", `Unsupported grant_type: ${b.grant_type}`);
  } catch (e) {
    return oauthErrorResponse(e);
  }
}

export const OPTIONS = preflight;
