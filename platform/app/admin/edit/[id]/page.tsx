import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import EditReportForm from "../../EditReportForm";
import type { Client, Report } from "@/lib/types";

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const [{ data: report }, { data: clientsData }] = await Promise.all([
    admin.from("reports").select("*").eq("id", id).maybeSingle<Report>(),
    admin.from("clients").select("*").order("name"),
  ]);
  if (!report) notFound();

  return (
    <>
      <header className="admin-head">
        <Link href="/admin" className="admin-back">
          ← Volver al panel
        </Link>
        <h1>Editar informe</h1>
        <p>
          Cambia los metadatos del informe. El fichero HTML solo se reemplaza si
          subes uno nuevo.
        </p>
      </header>
      <section className="admin-section">
        <EditReportForm report={report} clients={(clientsData ?? []) as Client[]} />
      </section>
    </>
  );
}
