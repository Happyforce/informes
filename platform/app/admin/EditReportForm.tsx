"use client";

import { useActionState, useMemo, useState } from "react";
import ReportCard from "@/components/ReportCard";
import { updateReportAction } from "./actions";
import { COVER_OPTIONS, type Client, type Report } from "@/lib/types";

/**
 * Edit an already-published report's metadata and/or kind. The file is only
 * replaced if a new one is uploaded; the slug is fixed (so /r/{slug} links
 * never break).
 */
export default function EditReportForm({
  report,
  clients,
}: {
  report: Report;
  clients: Client[];
}) {
  const [source, setSource] = useState<"file" | "link">(
    report.kind === "link" ? "link" : "file"
  );
  const [newFileName, setNewFileName] = useState("");
  const [newFileIsPdf, setNewFileIsPdf] = useState<boolean | null>(null);
  const [externalUrl, setExternalUrl] = useState(report.external_url ?? "");

  const [title, setTitle] = useState(report.title);
  const [description, setDescription] = useState(report.description ?? "");
  const [stats, setStats] = useState<{ num: string; label: string }[]>(() => {
    const s = [...(report.stats ?? [])];
    while (s.length < 3) s.push({ num: "", label: "" });
    return s.slice(0, 3);
  });
  const [edition, setEdition] = useState(report.edition ?? "");
  const [editionLabel, setEditionLabel] = useState(report.edition_label ?? "");
  const [cover, setCover] = useState(report.cover);
  const [badges, setBadges] = useState((report.badges ?? []).join(", "));
  const [publishedAt, setPublishedAt] = useState(report.published_at);
  const [canvaUrl, setCanvaUrl] = useState(report.canva_url ?? "");
  const [clientId, setClientId] = useState(report.client_id ?? "");

  const [state, formAction, isPending] = useActionState(updateReportAction, null);

  const kind =
    source === "link"
      ? "link"
      : newFileIsPdf !== null
        ? newFileIsPdf
          ? "pdf"
          : "html"
        : report.kind === "pdf"
          ? "pdf"
          : "html";

  const selectedSlug = clients.find((c) => c.id === clientId)?.slug ?? "";

  const previewReport = useMemo<Report>(
    () => ({
      ...report,
      title: title || "Título del informe",
      description: description || "Descripción del informe.",
      visibility: clientId ? "client" : "public",
      kind,
      cover,
      badges: badges.split(",").map((b) => b.trim()).filter(Boolean),
      stats: stats.filter((s) => s.num && s.label),
      edition: edition || null,
      edition_label: editionLabel || null,
      canva_url: canvaUrl || null,
      external_url: externalUrl || null,
      published_at: publishedAt,
    }),
    [report, title, description, clientId, kind, cover, badges, stats, edition, editionLabel, canvaUrl, externalUrl, publishedAt]
  );

  return (
    <form action={formAction} className="admin-form upload-form" aria-busy={isPending}>
      <input type="hidden" name="id" value={report.id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="client_slug" value={selectedSlug} />

      <p className="hint" style={{ marginBottom: 12 }}>
        URL pública: <code>/r/{report.slug}</code> (no cambia al editar)
      </p>

      <div className="source-tabs">
        <button
          type="button"
          className={`source-tab${source === "file" ? " active" : ""}`}
          onClick={() => setSource("file")}
        >
          📄 Archivo (HTML o PDF)
        </button>
        <button
          type="button"
          className={`source-tab${source === "link" ? " active" : ""}`}
          onClick={() => setSource("link")}
        >
          🔗 Enlace externo
        </button>
      </div>

      {source === "file" ? (
        <div className="field">
          <label>
            {report.kind === "link"
              ? "Sube el fichero del informe"
              : "Reemplazar el fichero (opcional)"}
          </label>
          <input
            className="input"
            type="file"
            name="file"
            accept=".html,text/html,.pdf,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setNewFileName(f?.name ?? "");
              setNewFileIsPdf(
                f
                  ? f.name.toLowerCase().endsWith(".pdf") ||
                      f.type === "application/pdf"
                  : null
              );
            }}
          />
          <p className="hint">
            {newFileName
              ? `Se usará: ${newFileName}`
              : report.kind === "link"
                ? "Este informe era un enlace; sube un HTML o PDF para convertirlo en fichero."
                : `Fichero actual: ${report.slug}.${report.kind === "pdf" ? "pdf" : "html"}. Déjalo vacío para conservarlo.`}
          </p>
        </div>
      ) : (
        <div className="field">
          <label>Enlace al informe *</label>
          <input
            className="input"
            type="url"
            name="external_url"
            placeholder="https://drive.google.com/…"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
          />
        </div>
      )}

      <div className="upload-grid">
        <div className="upload-preview" aria-hidden>
          <div className="upload-preview-label">Vista previa</div>
          <ReportCard report={previewReport} />
        </div>

        <div className="upload-fields">
          <div className="field">
            <label>Título *</label>
            <input
              className="input"
              name="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Descripción</label>
            <textarea
              className="input"
              name="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Datos destacados (stats)</label>
            {stats.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input
                  className="input"
                  name={`stat${i + 1}_num`}
                  placeholder="1.395"
                  value={s.num}
                  onChange={(e) => {
                    const next = [...stats];
                    next[i] = { ...next[i], num: e.target.value };
                    setStats(next);
                  }}
                />
                <input
                  className="input"
                  name={`stat${i + 1}_label`}
                  placeholder="Personas"
                  value={s.label}
                  onChange={(e) => {
                    const next = [...stats];
                    next[i] = { ...next[i], label: e.target.value };
                    setStats(next);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="field">
            <label>Destino *</label>
            <select
              className="input"
              name="client_id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">🌍 Público (landing)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  🔒 {c.name}
                </option>
              ))}
            </select>
          </div>

          {source === "link" && clientId && (
            <div className="warn-note">
              ⚠ Enlace externo en un espacio privado: la privacidad real del
              fichero depende de sus permisos en la plataforma de origen.
            </div>
          )}
        </div>
      </div>

      <details className="upload-extra">
        <summary>Personalización de la tarjeta (opcional)</summary>
        <div className="admin-form-row" style={{ marginTop: 14 }}>
          <div className="field">
            <label>Portada</label>
            <select
              className="input"
              name="cover"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
            >
              {COVER_OPTIONS.map((c) => (
                <option key={c.cls} value={c.cls}>
                  {c.cls.replace("accent-", "")}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Badges (separados por coma)</label>
            <input
              className="input"
              name="badges"
              value={badges}
              onChange={(e) => setBadges(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Fecha de publicación</label>
            <input
              className="input"
              type="date"
              name="published_at"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
            />
          </div>
        </div>

        <div className="admin-form-row">
          <div className="field">
            <label>Edición (p. ej. IV)</label>
            <input
              className="input"
              name="edition"
              value={edition}
              onChange={(e) => setEdition(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Etiqueta de edición</label>
            <input
              className="input"
              name="edition_label"
              value={editionLabel}
              onChange={(e) => setEditionLabel(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Enlace a presentación (Canva)</label>
            <input
              className="input"
              type="url"
              name="canva_url"
              value={canvaUrl}
              onChange={(e) => setCanvaUrl(e.target.value)}
            />
          </div>
        </div>
      </details>

      {state?.error && (
        <div className="form-error" role="alert">
          ⚠ {state.error}
        </div>
      )}
      <button className="btn btn-accent" disabled={isPending}>
        {isPending ? (
          <>
            <span className="spinner" aria-hidden="true" /> Guardando cambios…
          </>
        ) : (
          "Guardar cambios"
        )}
      </button>
    </form>
  );
}
