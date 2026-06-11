"use client";

import { useMemo, useRef, useState } from "react";
import ReportCard from "@/components/ReportCard";
import { uploadReportAction } from "./actions";
import { extractReportMeta } from "@/lib/extract-report-meta";
import { COVER_OPTIONS, type Client, type Report } from "@/lib/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Upload form: drop the HTML, it parses the report and pre-fills the card
 * metadata (title, description, stats, edition, cover). The admin reviews a
 * live preview instead of transcribing. Rarely-edited / non-extractable
 * fields live in a collapsed "Personalización" section.
 */
export default function UploadReportForm({
  clients,
  fixedClient,
}: {
  clients: Client[];
  fixedClient?: Client;
}) {
  const [fileName, setFileName] = useState("");
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

  const selectedSlug = fixedClient
    ? fixedClient.slug
    : clients.find((c) => c.id === clientId)?.slug ?? "";

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
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

    const found =
      !!meta.title ||
      !!meta.description ||
      meta.stats.length > 0 ||
      !!meta.edition;
    setAutofilled(found);
  }

  // Synthetic Report for the live preview.
  const previewReport = useMemo<Report>(
    () => ({
      id: "preview",
      client_id: clientId || null,
      slug: "preview",
      title: title || "Título del informe",
      description:
        description || "La descripción aparecerá aquí cuando subas el informe.",
      visibility: clientId ? "client" : "public",
      cover,
      badges: badges
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean),
      stats: stats.filter((s) => s.num && s.label),
      edition: edition || null,
      edition_label: editionLabel || null,
      canva_url: canvaUrl || null,
      storage_path: "",
      published_at: publishedAt || today(),
      created_at: publishedAt || today(),
    }),
    [
      clientId, title, description, cover, badges, stats,
      edition, editionLabel, canvaUrl, publishedAt,
    ]
  );

  const hasFile = !!fileName;

  return (
    <form action={uploadReportAction} className="admin-form upload-form">
      {/* ─── Dropzone ─── */}
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
          // drag-drop doesn't populate a file input on its own — do it so the
          // file is actually submitted with the form.
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
          accept=".html,text/html"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <span className="dropzone-icon">{hasFile ? "📄" : "⬆️"}</span>
        <span className="dropzone-text">
          {hasFile ? (
            <>
              <b>{fileName}</b> — haz clic para cambiarlo
            </>
          ) : (
            <>
              Arrastra aquí el <b>.html</b> del informe o haz clic para elegirlo
            </>
          )}
        </span>
      </label>

      {hasFile && (
        <>
          {autofilled && (
            <div className="autofill-note">
              ✨ Rellenado automáticamente desde el informe. Revisa la tarjeta y
              corrige lo que haga falta.
            </div>
          )}

          {/* ─── Preview + main fields ─── */}
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

              {/* ─── Destino ─── */}
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
            </div>
          </div>

          {/* ─── Personalización (colapsada) ─── */}
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

          <button className="btn btn-accent">Publicar informe</button>
        </>
      )}
    </form>
  );
}
