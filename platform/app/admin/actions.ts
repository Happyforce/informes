"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReportStat } from "@/lib/types";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

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
  const { data: reports } = await admin
    .from("reports")
    .select("storage_path")
    .eq("client_id", id);
  const paths = (reports ?? []).map((r) => r.storage_path);
  if (paths.length) await admin.storage.from("reports").remove(paths);

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
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Email no válido");

  const admin = createAdminClient();
  const { error } = await admin
    .from("client_members")
    .insert({ client_id: clientId, email });
  if (error && !error.message.includes("duplicate")) {
    throw new Error(error.message);
  }
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

export async function uploadReportAction(
  _prev: UploadState,
  formData: FormData
): Promise<UploadState> {
  let redirectTo = "/admin";
  try {
    await requireAdmin();

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return { error: "Falta el fichero HTML." };
    if (!file.name.endsWith(".html") && file.type !== "text/html") {
      return { error: "El informe debe ser un fichero .html." };
    }

    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { error: "El título es obligatorio." };
    const slug = slugify(String(formData.get("slug") || title));
    const clientId = String(formData.get("client_id") ?? "");
    const visibility = clientId ? "client" : "public";
    redirectTo = clientId ? `/admin/${formData.get("client_slug")}` : "/admin";

    const stats: ReportStat[] = [];
    for (let i = 1; i <= 3; i++) {
      const num = String(formData.get(`stat${i}_num`) ?? "").trim();
      const label = String(formData.get(`stat${i}_label`) ?? "").trim();
      if (num && label) stats.push({ num, label });
    }

    const badges = String(formData.get("badges") ?? "")
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);

    const storagePath = `${visibility === "public" ? "public" : clientId}/${slug}.html`;

    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from("reports")
      .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
        contentType: "text/html",
        upsert: true,
      });
    if (upErr) return { error: `No se pudo subir el fichero: ${upErr.message}` };

    const { error } = await admin.from("reports").upsert(
      {
        slug,
        title,
        description: String(formData.get("description") ?? "").trim() || null,
        client_id: clientId || null,
        visibility,
        cover: String(formData.get("cover") || "accent-orange"),
        badges,
        stats,
        edition: String(formData.get("edition") ?? "").trim() || null,
        edition_label:
          String(formData.get("edition_label") ?? "").trim() || null,
        canva_url: String(formData.get("canva_url") ?? "").trim() || null,
        storage_path: storagePath,
        published_at:
          String(formData.get("published_at") || "") ||
          new Date().toISOString().slice(0, 10),
      },
      { onConflict: "slug" }
    );
    if (error) return { error: `No se pudo guardar el informe: ${error.message}` };

    revalidatePath("/admin");
    revalidatePath("/");
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error inesperado al publicar.",
    };
  }
  // Outside the try so the redirect's internal signal isn't swallowed.
  redirect(redirectTo);
}

export async function deleteReportAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const admin = createAdminClient();

  const { data: report } = await admin
    .from("reports")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (report) {
    await admin.storage.from("reports").remove([report.storage_path]);
  }
  const { error } = await admin.from("reports").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/");
}
