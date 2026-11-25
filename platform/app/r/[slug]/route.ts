import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedFileUrl } from "@/lib/reports";

/**
 * Report viewer. The permission check happens via RLS: we look the report up
 * with the caller's session client — public reports resolve for anyone,
 * client reports only for members/admins. Only after that hit do we touch
 * Storage (service role; the bucket is fully private).
 *
 * - html  → streamed through here (same origin, small files).
 * - pdf   → redirect to a short-lived signed Storage URL (no 4.5 MB limit).
 * - video → a branded player page whose <video> points at a signed Storage
 *           URL (Storage serves byte ranges, so seeking/iOS work).
 * - link  → redirect to the external URL.
 */

const PDF_URL_TTL = 60 * 60; // 1 h
const VIDEO_URL_TTL = 6 * 60 * 60; // 6 h: long enough to watch, pause, seek

type ReportRow = {
  kind: string;
  storage_path: string | null;
  external_url: string | null;
  visibility: string;
  title: string;
  description: string | null;
  published_at: string;
  clients: { slug: string; name: string } | { slug: string; name: string }[] | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: report } = await supabase
    .from("reports")
    .select(
      "kind, storage_path, external_url, visibility, title, description, published_at, clients(slug, name)"
    )
    .eq("slug", slug)
    .maybeSingle<ReportRow>();

  if (!report) {
    // Not found OR not allowed — don't reveal which. Logged-out users get a
    // chance to authenticate; logged-in users get a plain 404.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return new NextResponse("Informe no encontrado", { status: 404 });
  }

  const cacheControl =
    report.visibility === "public"
      ? "public, max-age=300"
      : "private, no-store";

  // External link: redirect (the permission check above already gated access).
  if (report.kind === "link") {
    if (!report.external_url || !/^https?:\/\//i.test(report.external_url)) {
      return new NextResponse("Enlace del informe no válido", { status: 502 });
    }
    return NextResponse.redirect(report.external_url, 302);
  }

  if (!report.storage_path) {
    return new NextResponse("El informe no tiene fichero asociado", {
      status: 500,
    });
  }

  if (report.kind === "pdf") {
    const url = await signedFileUrl(report.storage_path, PDF_URL_TTL);
    if (!url) return new NextResponse("Error al cargar el informe", { status: 500 });
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  if (report.kind === "video") {
    const url = await signedFileUrl(report.storage_path, VIDEO_URL_TTL);
    if (!url) return new NextResponse("Error al cargar el vídeo", { status: 500 });
    const client = Array.isArray(report.clients) ? report.clients[0] : report.clients;
    return new NextResponse(videoPage(report, url, client ?? null), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // The page embeds an expiring URL: never cache it.
        "Cache-Control": "private, no-store",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  }

  // HTML: stream from the private bucket.
  const admin = createAdminClient();
  const { data: file, error } = await admin.storage
    .from("reports")
    .download(report.storage_path);

  if (error || !file) {
    return new NextResponse("Error al cargar el informe", { status: 500 });
  }

  return new NextResponse(await file.text(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": cacheControl,
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}

// ─── Video player page ───────────────────────────────────────

const LOGO =
  "https://myhappyforce.com/wp-content/uploads/2019/12/logo_happyforce_horizontal-1024x269.png";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function videoPage(
  report: ReportRow,
  videoUrl: string,
  client: { slug: string; name: string } | null
): string {
  const back = client
    ? { href: `/c/${encodeURIComponent(client.slug)}`, label: "← Volver al espacio" }
    : { href: "/", label: "← Todos los informes" };

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(report.title)} · Informes Happyforce</title>
<link rel="icon" href="/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  :root { --ink:#111827; --muted:#6b7280; --border:#e5e7eb; --bg-alt:#f9fafb; --accent:#f26522; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:var(--ink); background:var(--bg-alt); -webkit-font-smoothing:antialiased; }
  nav { background:#fff; border-bottom:1px solid var(--border); }
  .nav-inner { max-width:1140px; margin:0 auto; padding:14px 24px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .nav-inner img { height:26px; display:block; }
  .back { color:var(--muted); text-decoration:none; font-size:14px; font-weight:600; }
  .back:hover { color:var(--accent); }
  main { max-width:1040px; margin:0 auto; padding:36px 24px 64px; }
  .eyebrow { display:inline-flex; align-items:center; gap:8px; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--accent); }
  h1 { font-size:clamp(24px,3.2vw,34px); font-weight:800; letter-spacing:-.02em; line-height:1.2; margin:10px 0 8px; }
  .meta { color:var(--muted); font-size:14px; }
  .player { margin-top:24px; background:#0f1923; border-radius:14px; overflow:hidden; box-shadow:0 20px 40px -12px rgba(0,0,0,.25); }
  video { display:block; width:100%; max-height:78vh; background:#0f1923; }
  .desc { margin-top:22px; font-size:16px; line-height:1.65; color:#374151; max-width:760px; white-space:pre-line; }
  footer { text-align:center; color:var(--muted); font-size:12.5px; padding:0 24px 32px; }
  @media (max-width:640px) { .nav-inner { padding:12px 16px; } main { padding:24px 16px 48px; } .player { border-radius:10px; } }
</style>
</head>
<body>
<nav><div class="nav-inner">
  <a href="/" aria-label="Informes Happyforce"><img src="${LOGO}" alt="Happyforce"></a>
  <a class="back" href="${back.href}">${esc(back.label)}</a>
</div></nav>
<main>
  <span class="eyebrow">▶ Vídeo${client ? ` · ${esc(client.name)}` : ""}</span>
  <h1>${esc(report.title)}</h1>
  <div class="meta">Publicado el ${esc(fmtDate(report.published_at))}</div>
  <div class="player">
    <video controls playsinline preload="metadata" controlslist="nodownload" src="${esc(videoUrl)}">
      Tu navegador no puede reproducir este vídeo.
    </video>
  </div>
  ${report.description ? `<p class="desc">${esc(report.description)}</p>` : ""}
</main>
<footer>Informes Happyforce${client ? " · Contenido confidencial" : ""}</footer>
</body>
</html>`;
}
