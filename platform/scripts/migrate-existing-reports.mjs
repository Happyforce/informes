/**
 * One-off migration: uploads the two existing static reports to the private
 * Storage bucket and registers them as PUBLIC reports in the database.
 *
 * Usage (from platform/, with .env.local populated):
 *   npm run migrate-reports
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

// Load platform/.env.local without depending on dotenv
try {
  const env = await readFile(resolve(here, "../.env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* rely on the shell environment */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ver .env.example)"
  );
  process.exit(1);
}
const supabase = createClient(url, key);

const REPORTS = [
  {
    file: "iv-informe-felicidad-2026.html",
    slug: "iv-informe-felicidad-2026",
    title: "IV Informe Mundial de Felicidad en el Trabajo 2026",
    description:
      "El estudio más completo sobre felicidad, compromiso y liderazgo en el trabajo. Brecha generacional, eNPS, bienestar, factores clave y el papel de la IA.",
    cover: "accent-orange",
    badges: ["Global", "2026"],
    stats: [
      { num: "1.395", label: "Personas" },
      { num: "15+", label: "Países" },
      { num: "20+", label: "Sectores" },
    ],
    edition: "IV",
    edition_label: "Edición · Anual",
    canva_url:
      "https://www.canva.com/design/DAHEUb8J56Y/2NIQDvydE_YFnSZzurY2WQ/view?utm_content=DAHEUb8J56Y&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h9a68d0512b#14",
    published_at: "2026-01-15",
  },
  {
    file: "informe_felicidad_vino.html",
    slug: "informe-felicidad-vino-2025",
    title: "Informe de Felicidad en el Trabajo en el Sector del Vino",
    description:
      "Por primera vez, el sector del vino español mide cómo se sienten quienes cada día hacen posible el vino. 8 dimensiones, sumillería, producción y distribución.",
    cover: "accent-wine",
    badges: ["Sectorial", "España 2025"],
    stats: [
      { num: "826", label: "Respuestas" },
      { num: "427", label: "Completadas" },
      { num: "8", label: "Dimensiones" },
    ],
    edition: "I",
    edition_label: "Edición · Pionero",
    canva_url: null,
    published_at: "2025-11-01",
  },
];

for (const r of REPORTS) {
  const html = await readFile(resolve(repoRoot, r.file));
  const storage_path = `public/${r.slug}.html`;

  const { error: upErr } = await supabase.storage
    .from("reports")
    .upload(storage_path, html, { contentType: "text/html", upsert: true });
  if (upErr) throw new Error(`${r.file}: upload failed — ${upErr.message}`);

  const { error } = await supabase.from("reports").upsert(
    {
      slug: r.slug,
      title: r.title,
      description: r.description,
      client_id: null,
      visibility: "public",
      cover: r.cover,
      badges: r.badges,
      stats: r.stats,
      edition: r.edition,
      edition_label: r.edition_label,
      canva_url: r.canva_url,
      storage_path,
      published_at: r.published_at,
    },
    { onConflict: "slug" }
  );
  if (error) throw new Error(`${r.file}: row upsert failed — ${error.message}`);

  console.log(`✓ ${r.slug} → ${storage_path}`);
}

console.log("Migración completada.");
