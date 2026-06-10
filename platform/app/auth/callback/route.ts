import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { destinationFor } from "@/lib/auth";

/**
 * Magic-link landing. Supabase redirects here with ?code=...; we exchange it
 * for a session and send the user to their place: admin → /admin,
 * client member → /c/{slug}, unknown email → /sin-acceso.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user?.email) {
      return NextResponse.redirect(
        origin + (await destinationFor(data.user.email))
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
