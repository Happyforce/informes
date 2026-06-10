import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default function SinAccesoPage() {
  return (
    <>
      <Nav label="Acceso clientes" />
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="sent-icon">🔒</div>
          <h1>Tu email no tiene espacio asignado</h1>
          <p className="sub" style={{ marginTop: 8 }}>
            Has iniciado sesión correctamente, pero tu email no está dado de
            alta en ningún espacio de cliente. Pide a tu contacto de Customer
            Advisory de Happyforce que te añada.
          </p>
          <Link className="btn btn-accent btn-block" href="/">
            Ver la biblioteca pública
          </Link>
        </div>
      </div>
      <Footer />
    </>
  );
}
