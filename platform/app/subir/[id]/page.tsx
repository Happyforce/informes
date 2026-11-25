import Link from "next/link";
import { getUser, isAdminEmail } from "@/lib/auth";
import UploadDrop, { UploadLogin } from "./UploadDrop";

/**
 * Upload page for the Claude chat (no terminal): prepare_upload gives Claude
 * a link to /subir/<uploadId>; the person drops the file here and it goes
 * straight to Storage; Claude then checks it with check_upload and publishes.
 */

export const dynamic = "force-dynamic";

const LOGO =
  "https://myhappyforce.com/wp-content/uploads/2019/12/logo_happyforce_horizontal-1024x269.png";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();

  let body: React.ReactNode;
  if (!UUID_RE.test(id)) {
    body = (
      <div className="auth-card">
        <h1>Enlace no válido</h1>
        <p className="sub">Pídele a Claude un enlace de subida nuevo.</p>
      </div>
    );
  } else if (!user?.email) {
    body = <UploadLogin />;
  } else if (!isAdminEmail(user.email)) {
    body = (
      <div className="auth-card">
        <h1>Cuenta sin permiso</h1>
        <p className="sub">
          Has entrado como <b>{user.email}</b>. Solo las cuentas @myhappyforce.com pueden subir
          informes.
        </p>
      </div>
    );
  } else {
    body = <UploadDrop uploadId={id} />;
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
            <span className="label">Subida para Claude</span>
          </div>
        </div>
      </nav>
      <div className="auth-wrap">{body}</div>
    </>
  );
}
