import Link from "next/link";
import { getUser, isAdminEmail, memberClientSlug } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

const LOGO =
  "https://myhappyforce.com/wp-content/uploads/2019/12/logo_happyforce_horizontal-1024x269.png";

export default async function Nav({ label }: { label: string }) {
  const user = await getUser();
  const admin = isAdminEmail(user?.email);
  const spaceSlug =
    user && !admin && user.email ? await memberClientSlug(user.email) : null;

  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-brand">
          <Link href="/" aria-label="Informes Happyforce">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="Happyforce" />
          </Link>
          <span className="divider"></span>
          <span className="label">{label}</span>
        </div>
        <div className="nav-right">
          {user ? (
            <>
              {admin && (
                <Link className="nav-cta" href="/admin">
                  Panel admin →
                </Link>
              )}
              {spaceSlug && (
                <Link className="nav-cta" href={`/c/${spaceSlug}`}>
                  Mi espacio →
                </Link>
              )}
              <div className="nav-user">
                <span className={`avatar${admin ? " dark" : ""}`}>
                  {(user.email ?? "??").slice(0, 2).toUpperCase()}
                </span>
                {user.email}
              </div>
              <LogoutButton />
            </>
          ) : (
            <Link className="nav-cta" href="/login">
              Acceder a mi espacio →
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
