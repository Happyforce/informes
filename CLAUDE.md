# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

Publishes Happyforce's workplace-happiness reports at `informes.myhappyforce.com`. Two generations coexist:

1. **Static site (repo root)** — the current production site on GitHub Pages. No build step: editing the HTML files is deploying.
2. **`platform/`** — the Next.js + Supabase platform replacing it: public library + private per-client spaces (magic-link auth) + admin panel for Customer Advisory. See `platform/README.md` for architecture, routes, and deployment (Vercel + Supabase). Tracked in Linear: project "Panel de Informes" (Product Team).

`prototype/` is the static clickable mock that validated the platform's UX — reference only, don't extend it.

## Structure (static site, repo root)

- `index.html` — landing page. Currently links to the 2026 global report + its Canva presentation. New reports need a link added here if you want them discoverable from the root domain.
- `iv-informe-felicidad-2026.html` — 2026 global Happyforce report (~1045 lines). Spanish. Typography: `Plus Jakarta Sans`. Accent color: Happyforce orange (`--accent: #f26522`).
- `informe_felicidad_vino.html` — 2025 Spanish wine-sector report (~1814 lines). Spanish. Typography: `Source Sans 3` + `Playfair Display`. Palette: blue / yellow / turquoise (no Happyforce orange — this is sector-branded).
- `CNAME` — GitHub Pages custom domain.

## Shared conventions across reports

Each report is a **single self-contained HTML file** — markup, inline `<style>`, and inline `<script>` all live together. Reports do **not** share CSS, JS, or component code; each has its own visual system and palette. When starting a new report, copy an existing one as a template rather than trying to factor anything out.

- Sections are delimited by prominent comment banners (`<!-- SECTION-NAME -->` or `<!-- ═══ N. TITLE ═══ -->`). Use these to navigate the file, and keep the TOC/nav, the comment banners, and the `<section id="…">` anchors in sync — the sticky nav and "quick filter" buttons hash-link to these IDs.
- Charts use **Chart.js 4.4.1 via CDN**. All chart data is **hardcoded inline** in the script — there is no JSON or data file. If a statistic in the prose changes, the matching chart config must be updated by hand.
- Color constants are defined once at the top of each script block (e.g. `O/T/R/Y/N/B` in the 2026 report; `BLUE/YELLOW/TURQUOISE/AMBER/CORAL` in the wine report) and mirror the CSS custom properties in `:root`. Reuse the constants instead of hex-coding.
- Reveal-on-scroll is driven by an IntersectionObserver watching `.reveal` elements. Keep the class on new sections if you want them to animate in.

## Per-report script patterns (they differ)

- **2026 global report**: charts are top-level one-liners at the bottom of the file — `new Chart(document.getElementById('chartXxx'), {...})` called immediately, no wrapper.
- **Wine report**: charts are wrapped in `document.addEventListener('DOMContentLoaded', …)` with a `chartInstances` registry and one `initXxx()` function per chart. Add new charts by defining another `initXxx()` and calling it alongside the others.

Don't port one pattern onto the other mid-file — pick the pattern already in use in the report you're editing.

## Reports stay self-contained on the platform too

The platform does NOT change how reports are authored: each report remains a single self-contained HTML file. On the platform it lives in the private Supabase Storage bucket and is served verbatim by `/r/{slug}` after a permission check. Don't try to convert reports into React components.

## Deploying

- **Platform = production** since June 2026: `informes.myhappyforce.com` is served by Vercel (project `happyforce-team/informes`, Root Directory `platform/`, Supabase backend). The Vercel Git integration is connected: **pushing to `master` auto-deploys the platform**. Local dev: `cd platform && npm run dev` (port 4600; there is a `platform` entry in `.claude/launch.json`).
- The static HTML reports at the repo root are no longer served via the domain (DNS points to Vercel; old URLs redirect to `/r/{slug}`). They remain in the repo as the source files migrated into Supabase Storage.
