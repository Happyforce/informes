import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClientAction, deleteReportAction } from "./actions";
import UploadReportForm from "./UploadReportForm";
import type { Client, Report } from "@/lib/types";

export default async function AdminPage() {
  const admin = createAdminClient();
  const [{ data: clientsData }, { data: reportsData }, { data: membersData }] =
    await Promise.all([
      admin.from("clients").select("*").order("name"),
      admin.from("reports").select("*").order("published_at", { ascending: false }),
      admin.from("client_members").select("client_id"),
    ]);

  const clients = (clientsData ?? []) as Client[];
  const reports = (reportsData ?? []) as Report[];
  const memberCount = new Map<string, number>();
  for (const m of membersData ?? []) {
    memberCount.set(m.client_id, (memberCount.get(m.client_id) ?? 0) + 1);
  }
  const reportCount = new Map<string, number>();
  for (const r of reports) {
    if (r.client_id) {
      reportCount.set(r.client_id, (reportCount.get(r.client_id) ?? 0) + 1);
    }
  }
  const publicReports = reports.filter((r) => r.visibility === "public");

  return (
    <>
      <header className="admin-head">
        <h1>Panel de administración</h1>
        <p>
          Espacios de cliente, miembros con acceso e informes publicados.
        </p>
      </header>

      {/* ─── Clients ─── */}
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Clientes ({clients.length})</h2>
        </div>
        <div className="admin-grid">
          {clients.map((c) => (
            <Link key={c.id} href={`/admin/${c.slug}`} className="admin-card">
              <span
                className="client-chip"
                style={{ background: c.color }}
              >
                {c.initials}
              </span>
              <div>
                <div className="admin-card-title">{c.name}</div>
                <div className="admin-card-meta">
                  {memberCount.get(c.id) ?? 0} miembros ·{" "}
                  {reportCount.get(c.id) ?? 0} informes · /c/{c.slug}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <details className="admin-details">
          <summary>+ Dar de alta un cliente</summary>
          <form action={createClientAction} className="admin-form">
            <div className="field">
              <label>Nombre *</label>
              <input className="input" name="name" required placeholder="Acme Corp" />
            </div>
            <div className="admin-form-row">
              <div className="field">
                <label>Slug (URL)</label>
                <input className="input" name="slug" placeholder="acme-corp (auto)" />
              </div>
              <div className="field">
                <label>Iniciales</label>
                <input className="input" name="initials" maxLength={3} placeholder="AC" />
              </div>
              <div className="field">
                <label>Color de marca</label>
                <input className="input" type="color" name="color" defaultValue="#f26522" />
              </div>
            </div>
            <button className="btn btn-accent">Crear cliente</button>
          </form>
        </details>
      </section>

      {/* ─── Public reports ─── */}
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Informes públicos ({publicReports.length})</h2>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Informe</th>
              <th>Publicado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {publicReports.map((r) => (
              <tr key={r.id}>
                <td>
                  <a href={`/r/${r.slug}`} target="_blank">
                    {r.title}
                  </a>
                </td>
                <td>{r.published_at}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link href={`/admin/edit/${r.id}`} className="row-edit-link">
                    Editar
                  </Link>
                  <form action={deleteReportAction} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn-danger-link">Eliminar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <details className="admin-details">
          <summary>+ Subir un informe</summary>
          <UploadReportForm clients={clients} />
        </details>
      </section>
    </>
  );
}
