import { notFound, redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ReportCard from "@/components/ReportCard";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import type { Client, Report } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientSpacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const user = await getUser();
  if (!user) redirect(`/login`);

  // RLS does the heavy lifting: a non-member simply gets no row back.
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Client>();

  if (!client) notFound();

  const { data } = await supabase
    .from("reports")
    .select("*")
    .eq("client_id", client.id)
    .order("published_at", { ascending: false });

  const reports = (data ?? []) as Report[];
  const years = [...new Set(reports.map((r) => r.published_at.slice(0, 4)))];

  return (
    <>
      <Nav label="Espacio de cliente" />

      <header
        className="client-hero"
        style={{ ["--client-color" as string]: client.color }}
      >
        <div className="client-hero-inner">
          <div className="client-mark">{client.initials || client.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <span className="client-kicker">Espacio privado</span>
            <h1>{client.name}</h1>
            <p>
              Informes preparados por tu equipo de Customer Advisory de
              Happyforce.
            </p>
          </div>
        </div>
      </header>

      <section className="reports">
        <div className="reports-head">
          <h2>
            Tus informes{years.length > 1 ? ` · ${years.join(" – ")}` : ""}
          </h2>
          <span className="count">
            {reports.length} {reports.length === 1 ? "informe" : "informes"}
          </span>
        </div>
        {reports.length === 0 ? (
          <div className="empty-state">
            Aún no hay informes publicados en tu espacio. Te avisaremos cuando
            haya novedades.
          </div>
        ) : (
          <div className="grid">
            {reports.map((r) => (
              <ReportCard key={r.id} report={r} showDate />
            ))}
          </div>
        )}
      </section>

      <Footer />
    </>
  );
}
