import { createClient } from "@/lib/supabase/server";

export const ADMIN_DOMAIN = "@myhappyforce.com";

export function isAdminEmail(email: string | undefined | null): boolean {
  return (email ?? "").toLowerCase().endsWith(ADMIN_DOMAIN);
}

/** Current authenticated user (or null). */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Throws if the caller is not a Happyforce admin. Server actions and admin
 * routes call this before touching the service-role client.
 */
export async function requireAdmin() {
  const user = await getUser();
  if (!user || !isAdminEmail(user.email)) {
    throw new Error("forbidden: admin account required");
  }
  return user;
}

/** Slug of the first client this email belongs to (member spaces). */
export async function memberClientSlug(email: string): Promise<string | null> {
  const supabase = await createClient();
  // RLS lets a user read their own membership rows + the matching client.
  const { data } = await supabase
    .from("client_members")
    .select("client_id, clients(slug)")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  const clients = data?.clients as { slug: string } | { slug: string }[] | null | undefined;
  if (!clients) return null;
  return Array.isArray(clients) ? clients[0]?.slug ?? null : clients.slug;
}

/** Where a freshly authenticated user should land. */
export async function destinationFor(email: string): Promise<string> {
  if (isAdminEmail(email)) return "/admin";
  const slug = await memberClientSlug(email);
  return slug ? `/c/${slug}` : "/sin-acceso";
}
