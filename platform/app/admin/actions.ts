"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMember, inviteToAuth } from "@/lib/members";
import { createApiToken, revokeApiToken } from "@/lib/api-tokens";
import { revokeConnection } from "@/lib/oauth";
import type { ReportStat } from "@/lib/types";
import {
  ReportError,
  createReport,
  createStagedUpload,
  deleteClientFiles,
  deleteReport,
  slugify,
  updateReport,
  type ReportFields,
  type StagedUpload,
} from "@/lib/reports";

// ─── Clients ─────────────────────────────────────────────────

export async function createClientAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("El nombre es obligatorio");
  const slug = slugify(String(formData.get("slug") || name));
  const color = String(formData.get("color") || "#f26522");
  const initials =
    String(formData.get("initials") ?? "").trim().toUpperCase() ||
    name.slice(0, 2).toUpperCase();

  const admin = createAdminClient();
  const { error } = await admin
    .from("clients")
    .insert({ name, slug, color, initials });
  if (error) throw new Error(`No se pudo crear el cliente: ${error.message}`);

  revalidatePath("/admin");
  redirect(`/admin/${slug}`);
}

export async function deleteClientAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const admin = createAdminClient();

  // Remove this client's report files from Storage first.
  await deleteClientFiles(id);

  const { error } = await admin.from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  redirect("/admin");
}

// ─── Members ─────────────────────────────────────────────────

export async function addMemberAction(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("client_id"));
  const clientSlug = String(formData.get("client_slug"));
  await addMember(clientId, String(formData.get("email") ?? ""));
  revalidatePath(`/admin/${clientSlug}`);
}

/**
 * Re-send the access email to a member who was saved but never got their Auth
 * account (e.g. the original invite was rate-limited). Safe to click on anyone:
 * if they already have an account it's a no-op.
 */
export async function resendMemberInviteAction(formData: FormData) {
  await requireAdmin();
  const clientSlug = String(formData.get("client_slug"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Email no válido");

  await inviteToAuth(createAdminClient(), email);

  revalidatePath(`/admin/${clientSlug}`);
}

export async function removeMemberAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const clientSlug = String(formData.get("client_slug"));
  const admin = createAdminClient();
  const { error } = await admin.from("client_members").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${clientSlug}`);
}

// ─── Reports ─────────────────────────────────────────────────

export type UploadState = { error: string } | null;

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ReportError) return e.message;
  return e instanceof Error ? e.message : fallback;
}

/**
 * Step 1 of a file upload: a signed URL so the browser can PUT the file
 * straight to Supabase Storage (videos and big PDFs would blow Vercel's
 * 4.5 MB request limit if they went through this action).
 */
export async function prepareUploadAction(
  fileName: string
): Promise<StagedUpload | { error: string }> {
  try {
    await requireAdmin();
    return await createStagedUpload(fileName);
  } catch (e) {
    return { error: errorMessage(e, "No se pudo preparar la subida.") };
  }
}

/** Card fields shared by the upload and edit forms. */
function readFields(formData: FormData): ReportFields {
  const stats: ReportStat[] = [];
  for (let i = 1; i <= 3; i++) {
    const num = String(formData.get(`stat${i}_num`) ?? "").trim();
    const label = String(formData.get(`stat${i}_label`) ?? "").trim();
    if (num && label) stats.push({ num, label });
  }
  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    cover: String(formData.get("cover") || "accent-orange"),
    badges: String(formData.get("badges") ?? "")
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean),
    stats,
    edition: String(formData.get("edition") ?? ""),
    editionLabel: String(formData.get("edition_label") ?? ""),
    canvaUrl: String(formData.get("canva_url") ?? ""),
    publishedAt: String(formData.get("published_at") ?? "").trim() || null,
  };
}

export async function uploadReportAction(
  _prev: UploadState,
  formData: FormData
): Promise<UploadState> {
  let redirectTo = "/admin";
  try {
    const user = await requireAdmin();
    const clientId = String(formData.get("client_id") ?? "");
    redirectTo = clientId ? `/admin/${formData.get("client_slug")}` : "/admin";
    const isLink = formData.get("source") === "link";

    await createReport(
      {
        ...readFields(formData),
        title: String(formData.get("title") ?? ""),
        slug: String(formData.get("slug") ?? "").trim() || undefined,
        clientId: clientId || null,
        stagedPath: isLink ? null : String(formData.get("staged_path") ?? "") || null,
        externalUrl: isLink ? String(formData.get("external_url") ?? "") : null,
      },
      user.email!
    );

    revalidatePath("/admin");
    revalidatePath("/");
  } catch (e) {
    return { error: errorMessage(e, "Error inesperado al publicar.") };
  }
  // Outside the try so the redirect's internal signal isn't swallowed.
  redirect(redirectTo);
}

export async function updateReportAction(
  _prev: UploadState,
  formData: FormData
): Promise<UploadState> {
  let redirectTo = "/admin";
  try {
    await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return { error: "Falta el identificador del informe." };
    const clientId = String(formData.get("client_id") ?? "");
    redirectTo = clientId ? `/admin/${formData.get("client_slug")}` : "/admin";

    const isLink = formData.get("source") === "link";
    const stagedPath = String(formData.get("staged_path") ?? "") || null;
    const wasLink = formData.get("current_kind") === "link";
    if (!isLink && !stagedPath && wasLink) {
      return { error: "Para convertir el enlace en fichero, sube el fichero." };
    }

    await updateReport(id, {
      ...readFields(formData),
      clientId: clientId || null,
      stagedPath: isLink ? null : stagedPath,
      externalUrl: isLink ? String(formData.get("external_url") ?? "") : null,
    });

    revalidatePath("/admin");
    revalidatePath("/");
  } catch (e) {
    return { error: errorMessage(e, "Error inesperado al guardar.") };
  }
  redirect(redirectTo);
}

export async function deleteReportAction(formData: FormData) {
  await requireAdmin();
  await deleteReport(String(formData.get("id")));
  revalidatePath("/admin");
  revalidatePath("/");
}

// ─── Claude (API tokens for the MCP server) ──────────────────

export type TokenState = { token?: string; error?: string } | null;

export async function createTokenAction(
  _prev: TokenState,
  formData: FormData
): Promise<TokenState> {
  try {
    const user = await requireAdmin();
    const token = await createApiToken(
      user.email!,
      String(formData.get("name") ?? "")
    );
    revalidatePath("/admin/claude");
    return { token };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear el token." };
  }
}

export async function revokeTokenAction(formData: FormData) {
  const user = await requireAdmin();
  await revokeApiToken(user.email!, String(formData.get("id")));
  revalidatePath("/admin/claude");
}

export async function revokeConnectionAction(formData: FormData) {
  const user = await requireAdmin();
  await revokeConnection(user.email!, String(formData.get("id")));
  revalidatePath("/admin/claude");
}
