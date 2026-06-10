import { uploadReportAction } from "./actions";
import { COVER_OPTIONS, type Client } from "@/lib/types";

/**
 * Server-rendered upload form (plain <form> + server action).
 * `fixedClient` pins the destination when used from a client detail page.
 */
export default function UploadReportForm({
  clients,
  fixedClient,
}: {
  clients: Client[];
  fixedClient?: Client;
}) {
  return (
    <form action={uploadReportAction} className="admin-form">
      <div className="field">
        <label>Fichero HTML del informe *</label>
        <input className="input" type="file" name="file" accept=".html,text/html" required />
      </div>

      {fixedClient ? (
        <>
          <input type="hidden" name="client_id" value={fixedClient.id} />
          <input type="hidden" name="client_slug" value={fixedClient.slug} />
          <p className="hint">
            Se publicará en el espacio privado de <b>{fixedClient.name}</b>.
          </p>
        </>
      ) : (
        <div className="field">
          <label>Destino *</label>
          <select className="input" name="client_id" defaultValue="">
            <option value="">🌍 Público (landing)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                🔒 {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label>Título *</label>
        <input className="input" name="title" required />
      </div>
      <div className="field">
        <label>Descripción</label>
        <textarea className="input" name="description" rows={3} />
      </div>

      <div className="admin-form-row">
        <div className="field">
          <label>Slug (URL)</label>
          <input className="input" name="slug" placeholder="auto desde el título" />
        </div>
        <div className="field">
          <label>Fecha de publicación</label>
          <input className="input" type="date" name="published_at" />
        </div>
        <div className="field">
          <label>Portada</label>
          <select className="input" name="cover" defaultValue="accent-orange">
            {COVER_OPTIONS.map((c) => (
              <option key={c.cls} value={c.cls}>
                {c.cls.replace("accent-", "")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-form-row">
        <div className="field">
          <label>Badges (separados por coma)</label>
          <input className="input" name="badges" placeholder="Global, 2026" />
        </div>
        <div className="field">
          <label>Edición (p. ej. IV)</label>
          <input className="input" name="edition" />
        </div>
        <div className="field">
          <label>Etiqueta de edición</label>
          <input className="input" name="edition_label" placeholder="Edición · Anual" />
        </div>
      </div>

      <div className="admin-form-row">
        {[1, 2, 3].map((i) => (
          <div className="field" key={i}>
            <label>Stat {i}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" name={`stat${i}_num`} placeholder="1.395" />
              <input className="input" name={`stat${i}_label`} placeholder="Personas" />
            </div>
          </div>
        ))}
      </div>

      <div className="field">
        <label>Enlace a presentación (Canva, opcional)</label>
        <input className="input" type="url" name="canva_url" placeholder="https://www.canva.com/…" />
      </div>

      <button className="btn btn-accent">Publicar informe</button>
    </form>
  );
}
