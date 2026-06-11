import { COVER_OPTIONS } from "@/lib/types";

export interface ExtractedMeta {
  title: string;
  description: string;
  stats: { num: string; label: string }[];
  edition: string | null;
  editionLabel: string | null;
  cover: string | null;
  badges: string[];
}

// Leading roman numeral in the title ("IV Informe…", "I Informe…")
const ROMAN = /^(IX|IV|V?I{1,3}|VI{1,3}|X)\b/;

function parseHex(input: string): { r: number; g: number; b: number } | null {
  let h = input.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Map a report's own --accent color to the nearest card cover gradient. */
function nearestCover(hex: string): string | null {
  const target = parseHex(hex);
  if (!target) return null;
  let best: string = COVER_OPTIONS[0].cls;
  let bestDist = Infinity;
  for (const opt of COVER_OPTIONS) {
    const c = parseHex(opt.hex);
    if (!c) continue;
    const d =
      (c.r - target.r) ** 2 + (c.g - target.g) ** 2 + (c.b - target.b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = opt.cls;
    }
  }
  return best;
}

/**
 * Pull card metadata out of a self-contained report HTML file. Runs in the
 * browser (uses DOMParser). Anything it can't find comes back empty/null so
 * the form degrades to manual entry — never worse than typing it all by hand.
 */
export function extractReportMeta(html: string): ExtractedMeta {
  const empty: ExtractedMeta = {
    title: "",
    description: "",
    stats: [],
    edition: null,
    editionLabel: null,
    cover: null,
    badges: [],
  };
  if (typeof DOMParser === "undefined") return empty;

  const doc = new DOMParser().parseFromString(html, "text/html");

  // Title — strip a trailing " | Happyforce" / " — Happyforce" style suffix.
  let title = (doc.querySelector("title")?.textContent ?? "").trim();
  title = title.replace(/\s*[|—–-]\s*Happyforce\s*$/i, "").trim();

  // Edition — leading roman numeral.
  let edition: string | null = null;
  let editionLabel: string | null = null;
  const rm = title.match(ROMAN);
  if (rm) {
    edition = rm[1];
    editionLabel = "Edición";
  }

  const description = (
    doc.querySelector('meta[name="description"]')?.getAttribute("content") ?? ""
  ).trim();

  // Stats — pair .hero-stat-num with .hero-stat-label, first three.
  const nums = [...doc.querySelectorAll(".hero-stat-num")].map(
    (e) => e.textContent?.trim() ?? ""
  );
  const labels = [...doc.querySelectorAll(".hero-stat-label")].map(
    (e) => e.textContent?.trim() ?? ""
  );
  const stats = nums
    .slice(0, 3)
    .map((num, i) => ({ num, label: labels[i] ?? "" }))
    .filter((s) => s.num && s.label);

  // Cover — nearest gradient to the report's own --accent.
  let cover: string | null = null;
  const styleText = [...doc.querySelectorAll("style")]
    .map((s) => s.textContent ?? "")
    .join("\n");
  const accent = styleText.match(/--accent\s*:\s*(#[0-9a-fA-F]{3,8})/);
  if (accent) cover = nearestCover(accent[1]);

  // Badges — year from the title, if present.
  const badges: string[] = [];
  const year = title.match(/\b(20\d{2})\b/);
  if (year) badges.push(year[1]);

  return { title, description, stats, edition, editionLabel, cover, badges };
}
