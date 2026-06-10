import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, destinationFor } from "@/lib/auth";
import LoginForm from "./LoginForm";

const LOGO =
  "https://myhappyforce.com/wp-content/uploads/2019/12/logo_happyforce_horizontal-1024x269.png";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getUser();
  if (user?.email) {
    redirect(await destinationFor(user.email));
  }

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-brand">
            <Link href="/" aria-label="Informes Happyforce">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO} alt="Happyforce" />
            </Link>
            <span className="divider"></span>
            <span className="label">Acceso clientes</span>
          </div>
          <Link className="nav-cta" href="/">
            ← Volver a la biblioteca
          </Link>
        </div>
      </nav>
      <div className="auth-wrap">
        <LoginForm />
      </div>
    </>
  );
}
