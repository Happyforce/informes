import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ReportCard from "@/components/ReportCard";
import { createClient } from "@/lib/supabase/server";
import type { Report } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("*")
    .eq("visibility", "public")
    .order("published_at", { ascending: false });

  const reports = (data ?? []) as Report[];

  return (
    <>
      <Nav label="Informes & Publicaciones" />

      <section className="hero">
        <span className="hero-eyebrow">Biblioteca pública</span>
        <h1>
          Informes sobre <em>felicidad, compromiso y liderazgo</em> en el
          trabajo.
        </h1>
        <p>
          Aquí publicamos los estudios, informes sectoriales y análisis que
          producimos en Happyforce. Datos abiertos, interactivos y en español.
        </p>
      </section>

      <section className="reports">
        <div className="reports-head">
          <h2>Publicaciones disponibles</h2>
          <span className="count">
            {reports.length} {reports.length === 1 ? "informe" : "informes"}
          </span>
        </div>
        <div className="grid">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      </section>

      <Footer />
    </>
  );
}
