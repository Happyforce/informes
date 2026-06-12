"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import ReportCard from "@/components/ReportCard";
import { uploadReportAction } from "./actions";
import { extractReportMeta } from "@/lib/extract-report-meta";
import { COVER_OPTIONS, type Client, type Report } from "@/lib/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Upload form. Three kinds of report:
 *  - file → HTML (auto-fills metadata + live preview) or PDF (manual)
 *  - link → external URL (Drive, etc.), metadata manual
 */
export default function UploadReportForm({
  clients,
  fixedClient,
}: {
  clients: Client[];
  fixedClient?: Client;
}) {
  const [source, setSource] = useState<"file" | "link">("file");
  const [fileName, setFileName] = useState("");
  const [fileIsPdf, setFileIsPdf] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [autofilled, setAutofilled] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stats, setStats] = useState<{ num: string; label: string }[]>([
    { num: "", label: "" },
    { num: "", label: "" },
    { num: "", label: "" },
  ]);
  const [edition, setEdition] = useState("");
  const [editionLabel, setEditionLabel] = useState("");
  const [cover, setCover] = useState("accent-orange");
  const [badges, setBadges] = useState("");
  const [publishedAt, setPublishedAt] = useState(today());
  const [canvaUrl, setCanvaUrl] = useState("");
  const [clientId, setClientId] = useState(fixedClient?.id ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState(uploadReportAction, null);

  const kind = source === "link" ? "link" : fileIsPdf ? "pdf" : "html";
  const selectedSlug = fixedClient
    ? fixedClient.slug
    : clients.find((c) => c.id === clientId)?.slug ?? "";
  const hasFile = !!fileName;
  const showFields = source === "link" ? externalUrl.trim().length > 0 : hasFile;

  async function onFile(file: File | undefined) {
    if (!file) return;
    const isPdf =
      file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    setFileIsPdf(isPdf);
    setFileName(file.name);

    if (isPdf) {
      // No structured metadata in a PDF — seed the title from the filename.
      if (!title) setTitle(file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "));
      setAutofilled(false);
      return;
    }

    const meta = extractReportMeta(await file.text());
    if (meta.title) setTitle(meta.title);
    if (meta.description) setDescription(meta.description);
    if (meta.stats.length) {
      const padded = [...meta.stats];
      while (padded.length < 3) padded.push({ num: "", label: "" });
      setStats(padded.slice(0, 3));
    }
    if (meta.edition) setEdition(meta.edition);
    if (meta.editionLabel) setEditionLabel(meta.editionLabel);
    if (meta.cover) setCover(meta.cover);
    if (meta.badges.length) setBadges(meta.badges.join(", "));
    setAutofilled(
      !!meta.title || !!meta.description || meta.stats.length > 0 || !!meta.edition
    );
  }

  const previewReport = useMemo<Report>(
    () => ({
      id: "preview",
      client_id: clientId || null,
      slug: "preview",
      title: title || "Título del informe",
      description:
        description || "La descripción aparecerá aquí cuando subas el informe.",
      visibility: clientId ? "client" : "public",
      kind,
      cover,
      badges: badges.split(",").map((b) => b.trim()).filter(Boolean),
      stats: stats.filter((s) => s.num && s.label),
      edition: edition || null,
      edition_label: editionLabel || null,
      canva_url: canvaUrl || null,
      storage_path: null,
      external_url: externalUrl || null,
      published_at: publishedAt || today(),
      created_at: publishedAt || today(),
    }),
    [clientId, kind, title, description, cover, badges, stats, edition, editionLabel, canvaUrl, externalUrl, publishedAt]
  );

  return (
    <form action={formAction} className="admin-form upload-form" aria-busy={isPending}>
      <input type="hidden" name="kind" value={kind} />

      {/* ─── Origen ─── */}
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
        <label
          className={`dropzone${dragging ? " dragging" : ""}${hasFile ? " has-file" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (fileInputRef.current && e.dataTransfer.files?.length) {
              fileInputRef.current.files = e.dataTransfer.files;
            }
            onFile(e.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            accept=".html,text/html,.pdf,application/pdf"
            hidden
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <span className="dropzone-icon">{hasFile ? (fileIsPdf ? "📕" : "📄") : "⬆️"}</span>
          <span className="dropzone-text">
            {hasFile ? (
              <>
                <b>{fileName}</b> — haz clic para cambiarlo
              </>
            ) : (
              <>
                Arrastra el <b>.html</b> o <b>.pdf</b> del informe, o haz clic
                para elegirlo
              </>
            )}
          </span>
        </label>
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
          <p className="hint">
            El informe se abrirá en esta URL (Google Drive, Notion, etc.).
          </p>
        </div>
      )}

      {showFields && (
        <>
          {autofilled && (
            <div className="autofill-note">
              ✨ Rellenado automáticamente desde el informe. Revisa la tarjeta y
              corrige lo que haga falta.
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

              {fixedClient ? (
                <>
                  <input type="hidden" name="client_id" value={fixedClient.id} />
                  <input type="hidden" name="client_slug" value={fixedClient.slug} />
                  <p className="hint">
                    Se publicará en el espacio privado de <b>{fixedClient.name}</b>.
                  </p>
                </>
              ) : (
                <>
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
                  <input type="hidden" name="client_slug" value={selectedSlug} />
                </>
              )}

              {source === "link" && clientId && (
                <div className="warn-note">
                  ⚠ Es un enlace externo en un espacio privado: la plataforma
                  controla quién ve la tarjeta, pero la privacidad real del
                  fichero depende de sus permisos en la plataforma de origen.
                  Asegúrate de restringir el acceso allí.
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
                  placeholder="Global, 2026"
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
                  placeholder="Edición · Anual"
                  value={editionLabel}
                  onChange={(e) => setEditionLabel(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Slug (URL)</label>
                <input className="input" name="slug" placeholder="auto desde el título" />
              </div>
            </div>

            <div className="field">
              <label>Enlace a presentación (Canva, opcional)</label>
              <input
                className="input"
                type="url"
                name="canva_url"
                placeholder="https://www.canva.com/…"
                value={canvaUrl}
                onChange={(e) => setCanvaUrl(e.target.value)}
              />
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
                <span className="spinner" aria-hidden="true" /> Publicando
                informe…
              </>
            ) : (
              "Publicar informe"
            )}
          </button>
          {isPending && (
            <p className="hint" style={{ marginTop: 4 }}>
              Publicando el informe, no cierres esta ventana…
            </p>
          )}
        </>
      )}
    </form>
  );
}
