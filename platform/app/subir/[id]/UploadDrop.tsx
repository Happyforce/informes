"use client";

import { useEffect, useRef, useState } from "react";
import EmailCodeLogin from "@/components/EmailCodeLogin";
import { extractReportMeta } from "@/lib/extract-report-meta";
import { FILE_ACCEPT, SOFT_MAX_BYTES, fileTypeFor, formatBytes } from "@/lib/report-files";
import { putFile } from "@/lib/upload-client";
import { signUploadPageAction, uploadStatusAction } from "./actions";

export function UploadLogin() {
  return (
    <EmailCodeLogin
      title="Sube el fichero para Claude"
      intro={
        <>
          Entra con tu email de Happyforce (<b>@myhappyforce.com</b>). Te
          enviaremos un código para escribirlo aquí.
        </>
      }
      onSignedIn={() => window.location.reload()}
    />
  );
}

type State =
  | { step: "idle" }
  | { step: "uploading"; name: string; size: number; progress: number }
  | { step: "done"; name: string; size: number }
  | { step: "error"; message: string };

/** Drop zone for a Claude chat upload: the file goes straight to Storage. */
export default function UploadDrop({ uploadId }: { uploadId: string }) {
  const [state, setState] = useState<State>({ step: "idle" });
  const [already, setAlready] = useState<{ fileName?: string; sizeBytes: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    uploadStatusAction(uploadId).then(setAlready).catch(() => {});
  }, [uploadId]);

  async function upload(file: File | undefined) {
    if (!file) return;
    const type = fileTypeFor(file.name);
    if (!type) {
      setState({ step: "error", message: `«${file.name}» no es un tipo admitido (.html, .pdf, .mp4, .webm o .mov).` });
      return;
    }
    if (file.size > SOFT_MAX_BYTES) {
      setState({
        step: "error",
        message: `El fichero pesa ${formatBytes(file.size)} y el máximo es 50 MB. Pídele a Claude que te ayude a comprimirlo (o usa Claude Code, que lo comprime solo).`,
      });
      return;
    }
    setState({ step: "uploading", name: file.name, size: file.size, progress: 0 });
    try {
      // Card metadata for Claude, who can't open the file from the chat.
      const metadata: Record<string, unknown> = { original_name: file.name };
      if (type.kind === "html") {
        const m = extractReportMeta(await file.text());
        Object.assign(metadata, {
          title: m.title || undefined,
          description: m.description || undefined,
          stats: m.stats.length ? m.stats : undefined,
          badges: m.badges.length ? m.badges : undefined,
          edition: m.edition || undefined,
          edition_label: m.editionLabel || undefined,
          cover: m.cover || undefined,
        });
      }
      const signed = await signUploadPageAction(uploadId, file.name);
      if ("error" in signed) throw new Error(signed.error);
      await putFile(signed.uploadUrl, file, signed.contentType, (p) =>
        setState({ step: "uploading", name: file.name, size: file.size, progress: p }),
        metadata
      );
      setState({ step: "done", name: file.name, size: file.size });
    } catch (e) {
      setState({ step: "error", message: e instanceof Error ? e.message : "La subida falló." });
    }
  }

  if (state.step === "done") {
    return (
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="sent-icon">✓</div>
        <h1>Fichero subido</h1>
        <p className="sub">
          <b style={{ color: "var(--ink)" }}>{state.name}</b> ({formatBytes(state.size)})
        </p>
        <p className="sub">
          Vuelve a Claude y dile <b style={{ color: "var(--ink)" }}>«ya está»</b>.
          Ya puedes cerrar esta pestaña.
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card upload-card">
      <h1>Sube el fichero para Claude</h1>
      <p className="sub">
        Arrastra aquí el informe (.html, .pdf o vídeo). Se guarda de forma
        privada y no se publica hasta que Claude te lo confirme.
      </p>
      {already && state.step === "idle" && (
        <div className="warn-note" style={{ marginBottom: 14 }}>
          Ya subiste un fichero con este enlace ({formatBytes(already.sizeBytes)}). Si subes
          otro, sustituye al anterior.
        </div>
      )}
      {state.step === "uploading" ? (
        <div>
          <p className="hint" style={{ marginBottom: 8 }}>
            Subiendo <b>{state.name}</b> ({formatBytes(state.size)})… {Math.round(state.progress * 100)} %
          </p>
          <div className="upload-progress" style={{ maxWidth: "none" }}>
            <div style={{ width: `${Math.round(state.progress * 100)}%` }} />
          </div>
          <p className="hint">No cierres esta pestaña hasta que termine.</p>
        </div>
      ) : (
        <label
          className={`dropzone${dragging ? " dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            upload(e.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={FILE_ACCEPT}
            hidden
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <span className="dropzone-icon">⬆️</span>
          <span className="dropzone-text">
            Arrastra el fichero aquí o <b>haz clic para elegirlo</b>
          </span>
        </label>
      )}
      {state.step === "error" && (
        <div className="form-error" role="alert" style={{ marginTop: 14 }}>
          ⚠ {state.message}
        </div>
      )}
    </div>
  );
}
