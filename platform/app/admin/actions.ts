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

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://informes.myhappyforce.com";

// Already has an Auth account (admins, re-grants, returning clients): they can
// log in via magic link, so there's nothing to send and it isn't an error.
const ALREADY_REGISTERED = /already|registered|exists/i;
// Supabase throttles auth emails; when several invites fire close together the
// later ones come back rate-limited (HTTP 429).
const RATE_LIMITED = /rate limit|too many|over_email_send/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Create the Supabase Auth user and send the branded "Invite user" email.
 * Retries on rate-limit so a burst of "Dar acceso" clicks doesn't leave members
 * stranded without an account. Returns whether the email already had an account
 * (in which case nothing was sent). Throws — leaving any member row in place so
 * it can be recovered with "Reenviar acceso" — when the email can't be sent.
 */
async function inviteToAuth(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<{ alreadyRegistered: boolean }> {
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${SITE_URL}/auth/callback`,
    });
    if (!error) return { alreadyRegistered: false };
    if (ALREADY_REGISTERED.test(error.message)) {
      return { alreadyRegistered: true };
    }
    lastError = error.message;
    if (!RATE_LIMITED.test(error.message)) break;
    await sleep(5000);
  }
  throw new Error(
    `No se pudo enviar el email de acceso (${lastError}). El acceso queda ` +
      `guardado; espera un momento y pulsa "Reenviar acceso".`
  );
}

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

  // Send the access email right away: this is what makes "Dar acceso" notify the
  // client, and — because the user now exists in Auth — their later logins get
  // the branded Magic Link template instead of the "Confirm signup" one.
  await inviteToAuth(admin, email);

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

  const admin = createAdminClient();
  await inviteToAuth(admin, email);

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

    const kind = String(formData.get("kind") || "html");
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { error: "El título es obligatorio." };
    const slug = slugify(String(formData.get("slug") || title));
    const clientId = String(formData.get("client_id") ?? "");
    const visibility = clientId ? "client" : "public";
    redirectTo = clientId ? `/admin/${formData.get("client_slug")}` : "/admin";
    const prefix = visibility === "public" ? "public" : clientId;

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

    const admin = createAdminClient();
    let storagePath: string | null = null;
    let externalUrl: string | null = null;

    if (kind === "link") {
      externalUrl = String(formData.get("external_url") ?? "").trim();
      if (!/^https?:\/\//i.test(externalUrl)) {
        return { error: "El enlace debe empezar por http:// o https://." };
      }
    } else {
      const file = formData.get("file") as File | null;
      if (!file || file.size === 0) return { error: "Falta el fichero del informe." };
      const isPdf = kind === "pdf";
      const okExt = isPdf
        ? file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"
        : file.name.toLowerCase().endsWith(".html") || file.type === "text/html";
      if (!okExt) {
        return { error: isPdf ? "El fichero debe ser un .pdf." : "El fichero debe ser un .html." };
      }
      storagePath = `${prefix}/${slug}.${isPdf ? "pdf" : "html"}`;
      const { error: upErr } = await admin.storage
        .from("reports")
        .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
          contentType: isPdf ? "application/pdf" : "text/html",
          upsert: true,
        });
      if (upErr) return { error: `No se pudo subir el fichero: ${upErr.message}` };
    }

    const { error } = await admin.from("reports").upsert(
      {
        slug,
        title,
        description: String(formData.get("description") ?? "").trim() || null,
        client_id: clientId || null,
        visibility,
        kind,
        cover: String(formData.get("cover") || "accent-orange"),
        badges,
        stats,
        edition: String(formData.get("edition") ?? "").trim() || null,
        edition_label:
          String(formData.get("edition_label") ?? "").trim() || null,
        canva_url: String(formData.get("canva_url") ?? "").trim() || null,
        storage_path: storagePath,
        external_url: externalUrl,
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

export async function updateReportAction(
  _prev: UploadState,
  formData: FormData
): Promise<UploadState> {
  let redirectTo = "/admin";
  try {
    await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return { error: "Falta el identificador del informe." };

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("reports")
      .select("slug, kind, storage_path, external_url")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return { error: "No se encontró el informe." };

    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { error: "El título es obligatorio." };

    const kind = String(formData.get("kind") || existing.kind || "html");
    const clientId = String(formData.get("client_id") ?? "");
    const visibility = clientId ? "client" : "public";
    redirectTo = clientId ? `/admin/${formData.get("client_slug")}` : "/admin";
    const prefix = visibility === "public" ? "public" : clientId;

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

    // Slug stays fixed (so /r/{slug} links never break).
    let storagePath: string | null = existing.storage_path;
    let externalUrl: string | null = existing.external_url;

    if (kind === "link") {
      externalUrl = String(formData.get("external_url") ?? "").trim();
      if (!/^https?:\/\//i.test(externalUrl)) {
        return { error: "El enlace debe empezar por http:// o https://." };
      }
      if (existing.storage_path) {
        await admin.storage.from("reports").remove([existing.storage_path]);
      }
      storagePath = null;
    } else {
      const isPdf = kind === "pdf";
      const newPath = `${prefix}/${existing.slug}.${isPdf ? "pdf" : "html"}`;
      const file = formData.get("file") as File | null;

      if (file && file.size > 0) {
        const okExt = isPdf
          ? file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"
          : file.name.toLowerCase().endsWith(".html") || file.type === "text/html";
        if (!okExt) {
          return { error: isPdf ? "El fichero debe ser un .pdf." : "El fichero debe ser un .html." };
        }
        const { error: upErr } = await admin.storage
          .from("reports")
          .upload(newPath, Buffer.from(await file.arrayBuffer()), {
            contentType: isPdf ? "application/pdf" : "text/html",
            upsert: true,
          });
        if (upErr) return { error: `No se pudo subir el fichero: ${upErr.message}` };
        if (existing.storage_path && existing.storage_path !== newPath) {
          await admin.storage.from("reports").remove([existing.storage_path]);
        }
      } else {
        // No new file: only valid if it was already this same file kind.
        if (existing.kind !== kind || !existing.storage_path) {
          return {
            error: `Para este tipo de informe necesitas subir el fichero ${isPdf ? "PDF" : "HTML"}.`,
          };
        }
        if (existing.storage_path !== newPath) {
          const { error: mvErr } = await admin.storage
            .from("reports")
            .move(existing.storage_path, newPath);
          if (mvErr) return { error: `No se pudo mover el fichero: ${mvErr.message}` };
        }
      }
      storagePath = newPath;
      externalUrl = null;
    }

    const publishedAt = String(formData.get("published_at") || "").trim();
    const { error } = await admin
      .from("reports")
      .update({
        title,
        description: String(formData.get("description") ?? "").trim() || null,
        client_id: clientId || null,
        visibility,
        kind,
        cover: String(formData.get("cover") || "accent-orange"),
        badges,
        stats,
        edition: String(formData.get("edition") ?? "").trim() || null,
        edition_label:
          String(formData.get("edition_label") ?? "").trim() || null,
        canva_url: String(formData.get("canva_url") ?? "").trim() || null,
        storage_path: storagePath,
        external_url: externalUrl,
        ...(publishedAt ? { published_at: publishedAt } : {}),
      })
      .eq("id", id);
    if (error) return { error: `No se pudo guardar: ${error.message}` };

    revalidatePath("/admin");
    revalidatePath("/");
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error inesperado al guardar.",
    };
  }
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
