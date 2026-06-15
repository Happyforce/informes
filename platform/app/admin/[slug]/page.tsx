import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addMemberAction,
  removeMemberAction,
  deleteReportAction,
  deleteClientAction,
} from "../actions";
import UploadReportForm from "../UploadReportForm";
import type { Client, ClientMember, Report } from "@/lib/types";

export default async function AdminClientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Client>();
  if (!client) notFound();

  const [{ data: membersData }, { data: reportsData }] = await Promise.all([
    admin
      .from("client_members")
      .select("*")
      .eq("client_id", client.id)
      .order("email"),
    admin
      .from("reports")
      .select("*")
      .eq("client_id", client.id)
      .order("published_at", { ascending: false }),
  ]);
  const members = (membersData ?? []) as ClientMember[];
  const reports = (reportsData ?? []) as Report[];

  return (
    <>
      <header className="admin-head">
        <Link href="/admin" className="admin-back">
          ← Volver al panel
        </Link>
        <div className="admin-head-row">
          <span className="client-chip lg" style={{ background: client.color }}>
            {client.initials}
          </span>
          <div>
            <h1>{client.name}</h1>
            <p>
              Espacio:{" "}
              <a href={`/c/${client.slug}`} target="_blank">
                /c/{client.slug}
              </a>
            </p>
          </div>
        </div>
      </header>

      {/* ─── Members ─── */}
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Acceso ({members.length})</h2>
        </div>
        <table className="admin-table">
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.email}</td>
                <td style={{ width: 1 }}>
                  <form action={removeMemberAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="client_slug" value={client.slug} />
                    <button className="btn-danger-link">Quitar</button>
                  </form>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td className="hint">Nadie tiene acceso todavía.</td>
              </tr>
            )}
          </tbody>
        </table>
        <form action={addMemberAction} className="admin-form-inline">
          <input type="hidden" name="client_id" value={client.id} />
          <input type="hidden" name="client_slug" value={client.slug} />
          <input
            className="input"
            type="email"
            name="email"
            placeholder="persona@cliente.com"
            required
          />
          <button className="btn btn-accent">Dar acceso</button>
        </form>
        <p className="hint">
          Al dar acceso, la persona recibe al instante un email de Happyforce
          con un enlace para entrar. Después podrá volver a entrar cuando quiera
          con un enlace mágico a ese mismo correo.
        </p>
      </section>

      {/* ─── Reports ─── */}
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Informes ({reports.length})</h2>
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
            {reports.map((r) => (
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
          <summary>+ Subir informe a este espacio</summary>
          <UploadReportForm clients={[]} fixedClient={client} />
        </details>
      </section>

      {/* ─── Danger zone ─── */}
      <section className="admin-section danger">
        <details>
          <summary>Eliminar este cliente</summary>
          <p className="hint">
            Se eliminan su espacio, sus miembros y sus {reports.length}{" "}
            informes (incluidos los ficheros). Esta acción no se puede
            deshacer.
          </p>
          <form action={deleteClientAction}>
            <input type="hidden" name="id" value={client.id} />
            <button className="btn-danger">Eliminar {client.name}</button>
          </form>
        </details>
      </section>
    </>
  );
}
