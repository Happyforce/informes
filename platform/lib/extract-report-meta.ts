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
// A standalone stat number: "66", "-3,55", "15+", "54%"
const NUM = /^[+-]?\d[\d.,]*\s*[%+]?$/;

function txt(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function clamp(s: string, max = 240): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 40 ? cut.slice(0, sp) : cut).trim() + "…";
}

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

/** Map a report's own brand color to the nearest card cover gradient. */
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

/** True for 01/02/03… index-like runs (a table of contents, not stats). */
function isSequentialIndex(nums: string[]): boolean {
  const ints = nums.map((n) => parseInt(n.replace(/[^\d]/g, ""), 10));
  if (ints.some((n) => Number.isNaN(n)) || ints.length < 3) return false;
  const sorted = [...ints].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

/** The caption for a figure: nearest non-numeric text in its block. */
function labelFor(numEl: Element): string {
  const block = numEl.parentElement;
  if (!block) return "";
  for (const sib of [...block.children]) {
    if (sib === numEl) continue;
    const t = txt(sib);
    if (t && !NUM.test(t)) return t.length > 48 ? t.slice(0, 48).trim() : t;
  }
  const rest = txt(block).replace(txt(numEl), "").trim();
  return rest.length > 48 ? rest.slice(0, 48).trim() : rest;
}

/**
 * Find a "key figures" row without relying on class names: collect leaf nodes
 * whose entire text is a number, group them by their grandparent (the row /
 * grid container), and pick the first group in document order that looks like
 * real stats — 2–5 figures, not a 01/02/03 index, and with a *distinct caption
 * per figure* (repeated labels mean a chart legend / quadrant axis, not stats).
 */
function extractStats(doc: Document): { num: string; label: string }[] {
  const body = doc.body;
  if (!body) return [];

  const numEls = [...body.querySelectorAll("*")].filter((el) => {
    if (el.children.length > 0) return false; // leaf only
    const t = txt(el);
    return t.length > 0 && t.length <= 8 && NUM.test(t);
  });

  const groups = new Map<Element, Element[]>();
  for (const el of numEls) {
    const g = el.parentElement?.parentElement;
    if (!g) continue;
    const arr = groups.get(g) ?? [];
    arr.push(el);
    groups.set(g, arr);
  }

  // Map preserves first-seen (≈ document) order — take the first that fits.
  for (const arr of groups.values()) {
    if (arr.length < 2 || arr.length > 5) continue;
    if (isSequentialIndex(arr.map((e) => txt(e)))) continue;

    const pairs = arr.map((numEl) => ({
      num: txt(numEl),
      label: labelFor(numEl),
    }));
    const labels = pairs.map((p) => p.label).filter(Boolean);
    const distinct = new Set(labels).size;
    // every figure needs a label, and they must be distinct
    if (labels.length < arr.length || distinct < arr.length) continue;

    return pairs.slice(0, 3);
  }
  return [];
}

/** First meaningful summary line: meta description → lead paragraph → first real <p>. */
function extractDescription(doc: Document): string {
  for (const sel of [
    'meta[name="description"]',
    'meta[property="og:description"]',
  ]) {
    const c = doc.querySelector(sel)?.getAttribute("content")?.trim();
    if (c) return clamp(c);
  }
  const hinted = [
    ...doc.querySelectorAll(
      "p.lead, p.intro, p.subtitle, p.summary, p.dek, .lead, .intro, .subtitle"
    ),
  ]
    .map(txt)
    .find((t) => t.length >= 30);
  if (hinted) return clamp(hinted);

  const ps = [...(doc.body?.querySelectorAll("p") ?? [])].map(txt);
  const first =
    ps.find((t) => t.length >= 50 && t.length <= 500) ??
    ps.find((t) => t.length >= 40);
  return first ? clamp(first) : "";
}

/**
 * Pull card metadata out of a self-contained report HTML file using generic
 * signals (not fixed class names), so it tolerates the heterogeneous markup of
 * AI-generated reports. Runs in the browser (DOMParser). Anything it can't find
 * comes back empty/null and the form degrades to manual entry.
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

  let title = (doc.querySelector("title")?.textContent ?? "").trim();
  title = title.replace(/\s*[|—–-]\s*Happyforce\s*$/i, "").trim();
  // Fall back to the first heading if there's no <title>.
  if (!title) title = txt(doc.querySelector("h1"));

  let edition: string | null = null;
  let editionLabel: string | null = null;
  const rm = title.match(ROMAN);
  if (rm) {
    edition = rm[1];
    editionLabel = "Edición";
  }

  const description = extractDescription(doc);
  const stats = extractStats(doc);

  // Cover — nearest gradient to the report's own brand color, if it exposes one.
  let cover: string | null = null;
  const styleText = [...doc.querySelectorAll("style")]
    .map((s) => s.textContent ?? "")
    .join("\n");
  const accent = styleText.match(
    /--(?:accent|brand|primary|accent-color|color-primary)\s*:\s*(#[0-9a-fA-F]{3,8})/i
  );
  if (accent) cover = nearestCover(accent[1]);

  const badges: string[] = [];
  const year = title.match(/\b(20\d{2})\b/);
  if (year) badges.push(year[1]);

  return { title, description, stats, edition, editionLabel, cover, badges };
}
