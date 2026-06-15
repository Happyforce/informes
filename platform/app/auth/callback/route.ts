import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { destinationFor } from "@/lib/auth";

/**
 * Auth landing. Two kinds of links arrive here, both end in a session:
 *  - Browser-initiated magic link (/login): PKCE `?code=…` → exchangeCodeForSession.
 *  - Server-initiated links (admin invite, and any email template that points
 *    here): `?token_hash=…&type=…` → verifyOtp. These have no PKCE verifier in
 *    the browser, so they can't use the code flow.
 * After login each user lands where they belong: admin → /admin,
 * client member → /c/{slug}, unknown email → /sin-acceso.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user?.email) {
      return NextResponse.redirect(
        origin + (await destinationFor(data.user.email))
      );
    }
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error && data.user?.email) {
      return NextResponse.redirect(
        origin + (await destinationFor(data.user.email))
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
