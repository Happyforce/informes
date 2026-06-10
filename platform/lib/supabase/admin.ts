import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Server-only, and every code path that
 * uses it must first verify the caller is a Happyforce admin (requireAdmin).
 * Needed for Storage (the reports bucket has no end-user policies: all file
 * access is mediated by our route handlers / server actions).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
