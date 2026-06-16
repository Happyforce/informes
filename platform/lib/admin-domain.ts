// Pure admin-domain check, free of server-only imports so it can be used from
// both server code (lib/auth.ts) and Client Components (the login form).
export const ADMIN_DOMAIN = "@myhappyforce.com";

/** Any email on the Happyforce domain is a Customer Advisory admin. */
export function isAdminEmail(email: string | undefined | null): boolean {
  return (email ?? "").toLowerCase().endsWith(ADMIN_DOMAIN);
}
