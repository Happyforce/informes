// File types a report can be uploaded as. Pure (no server imports) so the
// upload forms, the server actions and the MCP server all share one list.

import type { ReportKind } from "@/lib/types";

export type FileKind = Exclude<ReportKind, "link">;

export interface FileType {
  kind: FileKind;
  ext: string;
  contentType: string;
}

const TYPES: Record<string, FileType> = {
  html: { kind: "html", ext: "html", contentType: "text/html" },
  htm: { kind: "html", ext: "html", contentType: "text/html" },
  pdf: { kind: "pdf", ext: "pdf", contentType: "application/pdf" },
  mp4: { kind: "video", ext: "mp4", contentType: "video/mp4" },
  m4v: { kind: "video", ext: "mp4", contentType: "video/mp4" },
  webm: { kind: "video", ext: "webm", contentType: "video/webm" },
  mov: { kind: "video", ext: "mov", contentType: "video/quicktime" },
};

/** Accept attribute for <input type="file">. */
export const FILE_ACCEPT =
  ".html,.htm,text/html,.pdf,application/pdf,.mp4,.m4v,.webm,.mov,video/mp4,video/webm,video/quicktime";

/** Human list for hints and error messages. */
export const FILE_TYPES_LABEL = ".html, .pdf o vídeo (.mp4, .webm, .mov)";

/**
 * Supabase's default per-file limit is 50 MB (configurable in the dashboard
 * on paid plans). We warn above it rather than block: the upload itself will
 * fail with a clear error if the project limit is lower.
 */
export const SOFT_MAX_BYTES = 50 * 1024 * 1024;

export function fileTypeFor(fileName: string): FileType | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return TYPES[ext] ?? null;
}

export function kindLabel(kind: ReportKind): string {
  return { html: "HTML", pdf: "PDF", video: "Vídeo", link: "Enlace" }[kind];
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Staged uploads live under uploads/<uuid>.<ext> until a report claims them. */
export const STAGED_PATH_RE =
  /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(html|pdf|mp4|webm|mov)$/;
