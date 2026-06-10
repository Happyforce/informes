/* ============================================================
   Mock data + session helpers for the clickable prototype.
   No backend — everything is in-memory + localStorage.
   In production this is replaced by Supabase (Auth + Postgres + Storage).
   ============================================================ */

const HF_LOGO = "https://myhappyforce.com/wp-content/uploads/2019/12/logo_happyforce_horizontal-1024x269.png";
const HF_LOGO_DARK = "https://myhappyforce.com/wp-content/uploads/2020/01/logo-happyforce-dark-1.png";

/* ── Public reports (the real ones already live in the repo) ── */
const PUBLIC_REPORTS = [
  {
    id: "pub-2026-global",
    title: "IV Informe Mundial de Felicidad en el Trabajo 2026",
    desc: "El estudio más completo sobre felicidad, compromiso y liderazgo en el trabajo. Brecha generacional, eNPS, bienestar, factores clave y el papel de la IA.",
    cover: "accent-orange", badges: ["Global", "2026"],
    edition: "IV", editionLabel: "Edición · Anual",
    stats: [{num:"1.395",label:"Personas"},{num:"15+",label:"Países"},{num:"20+",label:"Sectores"}],
    href: "../iv-informe-felicidad-2026.html",
    canva: "https://www.canva.com/design/DAHEUb8J56Y/2NIQDvydE_YFnSZzurY2WQ/view",
    publishedAt: "2026-01-15"
  },
  {
    id: "pub-vino-2025",
    title: "Informe de Felicidad en el Trabajo en el Sector del Vino",
    desc: "Por primera vez, el sector del vino español mide cómo se sienten quienes cada día hacen posible el vino. 8 dimensiones, sumillería, producción y distribución.",
    cover: "accent-wine", badges: ["Sectorial", "España 2025"],
    edition: "I", editionLabel: "Edición · Pionero",
    stats: [{num:"826",label:"Respuestas"},{num:"427",label:"Completadas"},{num:"8",label:"Dimensiones"}],
    href: "../informe_felicidad_vino.html",
    publishedAt: "2025-09-10"
  }
];

/* ── Clients (private spaces) ── */
const CLIENTS = [
  {
    id: "c-aurora", slug: "bodegas-aurora", name: "Bodegas Aurora",
    color: "#722f37", cover: "accent-wine", initials: "BA",
    members: ["ana@bodegasaurora.com", "director@bodegasaurora.com"],
    reports: [
      {
        id: "r-aurora-q1", title: "Informe de Clima Laboral · Q1 2026",
        desc: "Resultados del primer trimestre: índice de felicidad, eNPS por bodega y planes de acción para enología y distribución.",
        cover: "accent-wine", badges: ["Trimestral", "Q1 2026"],
        edition: "Q1", editionLabel: "2026 · Trimestral",
        stats: [{num:"7,8",label:"Índice felicidad"},{num:"+42",label:"eNPS"},{num:"91%",label:"Participación"}],
        href: "../iv-informe-felicidad-2026.html", publishedAt: "2026-04-08"
      },
      {
        id: "r-aurora-2025", title: "Memoria Anual de Bienestar · 2025",
        desc: "Visión completa del año: evolución del compromiso, factores clave y comparativa frente al sector del vino.",
        cover: "accent-slate", badges: ["Anual", "2025"],
        edition: "'25", editionLabel: "Memoria anual",
        stats: [{num:"7,4",label:"Índice felicidad"},{num:"+38",label:"eNPS"},{num:"88%",label:"Participación"}],
        href: "../informe_felicidad_vino.html", publishedAt: "2026-01-20"
      }
    ]
  },
  {
    id: "c-nordia", slug: "nordia-retail", name: "Nordia Retail",
    color: "#2563eb", cover: "accent-blue", initials: "NR",
    members: ["laura@nordia.com"],
    reports: [
      {
        id: "r-nordia-q1", title: "Pulse de Compromiso · Q1 2026",
        desc: "Seguimiento del compromiso en tienda y oficinas centrales, con foco en rotación y liderazgo de mandos intermedios.",
        cover: "accent-blue", badges: ["Trimestral", "Q1 2026"],
        edition: "Q1", editionLabel: "2026 · Trimestral",
        stats: [{num:"7,1",label:"Índice felicidad"},{num:"+29",label:"eNPS"},{num:"84%",label:"Participación"}],
        href: "../iv-informe-felicidad-2026.html", publishedAt: "2026-04-02"
      }
    ]
  },
  {
    id: "c-helios", slug: "helios-energia", name: "Helios Energía",
    color: "#f59e0b", cover: "accent-orange", initials: "HE",
    members: ["rrhh@helios.com"],
    reports: []
  }
];

/* ── Session helpers (magic-link simulation) ── */
const ADMIN_DOMAIN = "@myhappyforce.com";

function hfGetSession() {
  try { return JSON.parse(localStorage.getItem("hf_session")); } catch { return null; }
}
function hfSetSession(email) {
  const isAdmin = email.toLowerCase().endsWith(ADMIN_DOMAIN);
  const client = CLIENTS.find(c => c.members.map(m=>m.toLowerCase()).includes(email.toLowerCase()));
  const sess = { email, isAdmin, clientSlug: client ? client.slug : null };
  localStorage.setItem("hf_session", JSON.stringify(sess));
  return sess;
}
function hfLogout() { localStorage.removeItem("hf_session"); location.href = "index.html"; }
function hfClientBySlug(slug) { return CLIENTS.find(c => c.slug === slug); }
function hfClientForEmail(email) {
  return CLIENTS.find(c => c.members.map(m=>m.toLowerCase()).includes((email||"").toLowerCase()));
}

/* Resolve where a freshly-authenticated email should land */
function hfDestinationFor(email) {
  const e = (email||"").toLowerCase();
  if (e.endsWith(ADMIN_DOMAIN)) return "admin.html";
  const client = hfClientForEmail(e);
  if (client) return "space.html?c=" + client.slug;
  return "login.html?nomatch=1";
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

/* tiny toast */
function hfToast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.innerHTML = '<span class="ok">✓</span>' + msg;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
}
