import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FILE_TYPES_LABEL,
  STAGED_PATH_RE,
  fileTypeFor,
} from "@/lib/report-files";
import type { Report, ReportKind, ReportStat } from "@/lib/types";

/**
 * Report publishing logic shared by the admin server actions and the Claude
 * MCP server (/api/mcp). Callers MUST have checked the caller is a Happyforce
 * admin first: everything here runs with the service-role client.
 *
 * Files never travel through our functions (Vercel caps request bodies at
 * 4.5 MB). Instead:
 *   1. createStagedUpload() hands out a signed upload URL for
 *      uploads/<uuid>.<ext>;
 *   2. the browser / Claude PUTs the file straight to Supabase Storage;
 *   3. createReport() / updateReport() claim the staged file and move it to
 *      <client_id|public>/<slug>-<rand>.<ext>.
 */

const BUCKET = "reports";

/** Error with a message that is safe and useful to show to the admin. */
export class ReportError extends Error {}

type Admin = ReturnType<typeof createAdminClient>;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shortId() {
  return randomUUID().slice(0, 8);
}

function checkUrl(url: string, what = "El enlace"): string {
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) {
    throw new ReportError(`${what} debe empezar por http:// o https://.`);
  }
  return u;
}

// ─── Staged uploads ──────────────────────────────────────────

export interface StagedUpload {
  uploadId: string;
  stagedPath: string;
  uploadUrl: string;
  contentType: string;
  kind: ReportKind;
  expiresInSeconds: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Drop staged uploads nobody claimed within a day (abandoned forms etc.). */
async function sweepStaleUploads(admin: Admin) {
  const { data } = await admin.storage.from(BUCKET).list("uploads", {
    limit: 100,
    sortBy: { column: "created_at", order: "asc" },
  });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const stale = (data ?? [])
    .filter((f) => f.created_at && Date.parse(f.created_at) < cutoff)
    .map((f) => `uploads/${f.name}`);
  if (stale.length) await admin.storage.from(BUCKET).remove(stale);
}

/** New upload id (uploads/<id>.<ext>), sweeping abandoned uploads first. */
export async function newUploadId(): Promise<string> {
  await sweepStaleUploads(createAdminClient()).catch(() => {});
  return randomUUID();
}

/**
 * Signed URL to PUT the file for upload <uploadId> (valid 2 h). Called by
 * prepare_upload (terminal/curl), by the admin forms and by the /subir page.
 */
export async function signUploadFor(uploadId: string, fileName: string): Promise<StagedUpload> {
  if (!UUID_RE.test(uploadId)) throw new ReportError("Identificador de subida no válido.");
  const type = fileTypeFor(fileName);
  if (!type) {
    throw new ReportError(`Tipo de fichero no admitido. Usa ${FILE_TYPES_LABEL}.`);
  }
  const admin = createAdminClient();
  // One file per upload id: if they pick another type, drop the previous one.
  const { data: previous } = await admin.storage.from(BUCKET).list("uploads", { search: uploadId });
  const others = (previous ?? [])
    .map((f) => `uploads/${f.name}`)
    .filter((p) => p !== `uploads/${uploadId}.${type.ext}`);
  if (others.length) await admin.storage.from(BUCKET).remove(others);

  const stagedPath = `uploads/${uploadId}.${type.ext}`;
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(stagedPath, { upsert: true });
  if (error || !data) {
    throw new ReportError(`No se pudo preparar la subida: ${error?.message}`);
  }
  return {
    uploadId,
    stagedPath,
    uploadUrl: data.signedUrl,
    contentType: type.contentType,
    kind: type.kind,
    expiresInSeconds: 2 * 60 * 60, // Supabase signed upload URLs last 2 h
  };
}

export async function createStagedUpload(fileName: string): Promise<StagedUpload> {
  return signUploadFor(await newUploadId(), fileName);
}

export interface StagedFile {
  stagedPath: string;
  kind: ReportKind;
  sizeBytes: number;
  /** Card metadata the upload page extracted from an HTML report, if any. */
  extracted: Record<string, unknown> | null;
}

/** Has the file for <uploadId> arrived? */
export async function findStagedUpload(uploadId: string): Promise<StagedFile | null> {
  if (!UUID_RE.test(uploadId)) throw new ReportError("Identificador de subida no válido.");
  const admin = createAdminClient();
  const { data } = await admin.storage.from(BUCKET).list("uploads", { search: uploadId });
  const file = (data ?? []).find((f) => STAGED_PATH_RE.test(`uploads/${f.name}`));
  if (!file) return null;
  const stagedPath = `uploads/${file.name}`;
  const { data: info } = await admin.storage.from(BUCKET).info(stagedPath);
  return {
    stagedPath,
    kind: fileTypeFor(file.name)!.kind,
    sizeBytes: Number(file.metadata?.size ?? info?.size ?? 0),
    extracted: (info?.metadata as Record<string, unknown> | undefined) ?? null,
  };
}

/** Move a staged upload to its final place. Returns the new path + kind. */
async function claimStaged(
  admin: Admin,
  stagedPath: string,
  prefix: string,
  slug: string
): Promise<{ path: string; kind: ReportKind }> {
  if (!STAGED_PATH_RE.test(stagedPath)) {
    throw new ReportError("La ruta del fichero subido no es válida.");
  }
  const type = fileTypeFor(stagedPath)!;
  const { data: exists } = await admin.storage.from(BUCKET).exists(stagedPath);
  if (!exists) {
    throw new ReportError(
      "No encuentro el fichero subido. Puede que la subida no terminara o que " +
        "caducara (2 h): prepara una subida nueva y vuelve a subirlo."
    );
  }
  // New name on every upload: never overwrites the current file before the
  // database points at the new one, and busts any cached copy.
  const path = `${prefix}/${slug}-${shortId()}.${type.ext}`;
  const { error } = await admin.storage.from(BUCKET).move(stagedPath, path);
  if (error) throw new ReportError(`No se pudo guardar el fichero: ${error.message}`);
  return { path, kind: type.kind };
}

async function removeFiles(admin: Admin, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await admin.storage.from(BUCKET).remove(list);
}

async function checkClient(admin: Admin, clientId: string) {
  const { data } = await admin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (!data) throw new ReportError("El cliente indicado no existe.");
}

// ─── Create / update / delete ────────────────────────────────

export interface ReportFields {
  title?: string;
  description?: string | null;
  cover?: string;
  badges?: string[];
  stats?: ReportStat[];
  edition?: string | null;
  editionLabel?: string | null;
  canvaUrl?: string | null;
  publishedAt?: string | null;
}

export interface CreateReportInput extends ReportFields {
  title: string;
  /** null = public report (landing). */
  clientId: string | null;
  slug?: string;
  /** Exactly one of stagedPath / externalUrl. */
  stagedPath?: string | null;
  externalUrl?: string | null;
  /** Allow overwriting an existing report with the same slug. */
  replace?: boolean;
}

function fieldColumns(f: ReportFields) {
  const cols: Record<string, unknown> = {};
  if (f.title !== undefined) cols.title = f.title.trim();
  if (f.description !== undefined) cols.description = f.description?.trim() || null;
  if (f.cover !== undefined) cols.cover = f.cover || "accent-orange";
  if (f.badges !== undefined) cols.badges = f.badges;
  if (f.stats !== undefined) cols.stats = f.stats;
  if (f.edition !== undefined) cols.edition = f.edition?.trim() || null;
  if (f.editionLabel !== undefined) cols.edition_label = f.editionLabel?.trim() || null;
  if (f.canvaUrl !== undefined) {
    cols.canva_url = f.canvaUrl?.trim() ? checkUrl(f.canvaUrl, "El enlace de Canva") : null;
  }
  if (f.publishedAt) cols.published_at = f.publishedAt;
  return cols;
}

export async function createReport(
  input: CreateReportInput,
  actorEmail: string
): Promise<Report> {
  const admin = createAdminClient();
  const title = input.title?.trim();
  if (!title) throw new ReportError("El título es obligatorio.");
  const slug = slugify(input.slug || title);
  if (!slug) throw new ReportError("No se pudo generar la URL (slug) del informe.");

  const clientId = input.clientId || null;
  if (clientId) await checkClient(admin, clientId);

  const { data: existing } = await admin
    .from("reports")
    .select("id, storage_path")
    .eq("slug", slug)
    .maybeSingle();
  if (existing && !input.replace) {
    throw new ReportError(
      `Ya existe un informe con la URL /r/${slug}. Cambia el slug o edita el existente.`
    );
  }

  let kind: ReportKind;
  let storagePath: string | null = null;
  let externalUrl: string | null = null;
  if (input.stagedPath) {
    const claimed = await claimStaged(admin, input.stagedPath, clientId ?? "public", slug);
    kind = claimed.kind;
    storagePath = claimed.path;
  } else if (input.externalUrl) {
    kind = "link";
    externalUrl = checkUrl(input.externalUrl);
  } else {
    throw new ReportError("Falta el fichero o el enlace del informe.");
  }

  const { data, error } = await admin
    .from("reports")
    .upsert(
      {
        cover: "accent-orange",
        badges: [],
        stats: [],
        published_at: today(),
        ...fieldColumns(input),
        title,
        slug,
        client_id: clientId,
        visibility: clientId ? "client" : "public",
        kind,
        storage_path: storagePath,
        external_url: externalUrl,
        created_by: actorEmail,
      },
      { onConflict: "slug" }
    )
    .select("*")
    .single();
  if (error || !data) {
    await removeFiles(admin, [storagePath]);
    throw new ReportError(`No se pudo guardar el informe: ${error?.message}`);
  }
  if (existing?.storage_path && existing.storage_path !== storagePath) {
    await removeFiles(admin, [existing.storage_path]);
  }
  return data as Report;
}

export interface UpdateReportInput extends ReportFields {
  /** undefined = keep; null = make public. */
  clientId?: string | null;
  /** Replace the content with a freshly staged file… */
  stagedPath?: string | null;
  /** …or turn it into an external link. */
  externalUrl?: string | null;
}

export async function updateReport(
  id: string,
  input: UpdateReportInput
): Promise<Report> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle<Report>();
  if (!existing) throw new ReportError("No se encontró el informe.");
  if (input.title !== undefined && !input.title.trim()) {
    throw new ReportError("El título es obligatorio.");
  }

  const clientId =
    input.clientId === undefined ? existing.client_id : input.clientId || null;
  if (clientId && clientId !== existing.client_id) await checkClient(admin, clientId);
  const prefix = clientId ?? "public";

  let kind = existing.kind;
  let storagePath = existing.storage_path;
  let externalUrl = existing.external_url;
  const removeAfter: (string | null)[] = [];
  let movedFrom: string | null = null;

  if (input.stagedPath) {
    const claimed = await claimStaged(admin, input.stagedPath, prefix, existing.slug);
    kind = claimed.kind;
    storagePath = claimed.path;
    externalUrl = null;
    removeAfter.push(existing.storage_path);
  } else if (input.externalUrl) {
    kind = "link";
    externalUrl = checkUrl(input.externalUrl);
    storagePath = null;
    removeAfter.push(existing.storage_path);
  } else if (existing.storage_path && clientId !== existing.client_id) {
    // Moving between spaces: keep the file under the new owner's prefix.
    const ext = existing.storage_path.split(".").pop();
    const dest = `${prefix}/${existing.slug}-${shortId()}.${ext}`;
    const { error } = await admin.storage.from(BUCKET).move(existing.storage_path, dest);
    if (error) throw new ReportError(`No se pudo mover el fichero: ${error.message}`);
    movedFrom = existing.storage_path;
    storagePath = dest;
  }

  const { data, error } = await admin
    .from("reports")
    .update({
      ...fieldColumns(input),
      client_id: clientId,
      visibility: clientId ? "client" : "public",
      kind,
      storage_path: storagePath,
      external_url: externalUrl,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    // Roll the file side back so the row keeps pointing at something real.
    if (movedFrom && storagePath) {
      await admin.storage.from(BUCKET).move(storagePath, movedFrom);
    } else if (storagePath !== existing.storage_path) {
      await removeFiles(admin, [storagePath]);
    }
    throw new ReportError(`No se pudo guardar: ${error?.message}`);
  }
  await removeFiles(admin, removeAfter);
  return data as Report;
}

export async function deleteReport(id: string) {
  const admin = createAdminClient();
  const { data: report } = await admin
    .from("reports")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  const { error } = await admin.from("reports").delete().eq("id", id);
  if (error) throw new ReportError(error.message);
  await removeFiles(admin, [report?.storage_path]);
}

/** Remove every stored file of a client (before deleting the client). */
export async function deleteClientFiles(clientId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("reports")
    .select("storage_path")
    .eq("client_id", clientId);
  await removeFiles(admin, (data ?? []).map((r) => r.storage_path));
}

/** Short-lived URL to read a stored file directly from Storage. */
export async function signedFileUrl(path: string, expiresIn: number) {
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}
