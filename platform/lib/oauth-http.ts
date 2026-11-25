import { NextResponse } from "next/server";
import { OAuthError } from "@/lib/oauth";

// Shared HTTP bits for the OAuth endpoints: CORS (browser-based MCP clients
// call discovery/registration/token cross-origin) and RFC 6749 error bodies.

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store", ...extra },
  });
}

export function oauthErrorResponse(e: unknown) {
  if (e instanceof OAuthError) {
    return json({ error: e.code, error_description: e.message }, e.status);
  }
  console.error("[oauth]", e);
  return json({ error: "server_error", error_description: "Unexpected error" }, 500);
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Public origin of this deployment (https://informes.myhappyforce.com). */
export function originOf(request: Request) {
  return new URL(request.url).origin;
}

/** Read a POST body sent as form-urlencoded (the OAuth standard) or JSON. */
export async function readBody(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? "")]));
  }
  const form = new URLSearchParams(await request.text());
  return Object.fromEntries(form.entries());
}
