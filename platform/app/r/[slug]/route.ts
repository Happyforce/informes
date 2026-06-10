import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Report viewer. The permission check happens via RLS: we look the report up
 * with the caller's session client — public reports resolve for anyone,
 * client reports only for members/admins. Only after that hit do we touch
 * Storage (service role; the bucket is fully private).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: report } = await supabase
    .from("reports")
    .select("storage_path, visibility")
    .eq("slug", slug)
    .maybeSingle();

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
      "Cache-Control":
        report.visibility === "public"
          ? "public, max-age=300"
          : "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
