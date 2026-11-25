import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMember } from "@/lib/members";
import {
  ReportError,
  createReport,
  createStagedUpload,
  slugify,
  updateReport,
  type ReportFields,
} from "@/lib/reports";
import { COVER_OPTIONS, type Client, type Report, type ReportStat } from "@/lib/types";

/**
 * Tools exposed to Claude by the MCP server (/api/mcp). Every call runs as
 * the token's owner (a Happyforce admin) with the service-role client, the
 * same as the admin panel. Destructive operations (remove access, delete
 * reports/clients) are deliberately NOT exposed: they stay in the panel.
 */

export interface ToolContext {
  email: string; // token owner, recorded as the author of what they publish
  origin: string; // https://informes.myhappyforce.com
}

type Json = Record<string, unknown>;

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Json;
  annotations?: Json;
  run: (args: Json, ctx: ToolContext) => Promise<unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────

function str(args: Json, key: string): string | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  return String(v);
}

function req(args: Json, key: string): string {
  const v = str(args, key)?.trim();
  if (!v) throw new ReportError(`Falta el parámetro «${key}».`);
  return v;
}

async function resolveClient(ref: string): Promise<Client> {
  const admin = createAdminClient();
  const bySlug = await admin
    .from("clients")
    .select("*")
    .eq("slug", ref.trim().toLowerCase())
    .maybeSingle<Client>();
  if (bySlug.data) return bySlug.data;
  const byName = await admin
    .from("clients")
    .select("*")
    .ilike("name", `%${ref.trim()}%`);
  const matches = (byName.data ?? []) as Client[];
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new ReportError(
      `«${ref}» coincide con varios clientes: ${matches.map((c) => c.slug).join(", ")}. Usa el slug.`
    );
  }
  throw new ReportError(`No existe ningún cliente «${ref}». Usa list_clients para ver los slugs.`);
}

function reportOut(r: Report, ctx: ToolContext) {
  return {
    slug: r.slug,
    title: r.title,
    kind: r.kind,
    published_at: r.published_at,
    description: r.description,
    url: `${ctx.origin}/r/${r.slug}`,
    edit_url: `${ctx.origin}/admin/edit/${r.id}`,
    ...(r.created_by ? { created_by: r.created_by } : {}),
  };
}

function readFields(args: Json): ReportFields {
  const f: ReportFields = {};
  if (args.title !== undefined) f.title = String(args.title);
  if (args.description !== undefined) f.description = str(args, "description") ?? null;
  if (args.cover !== undefined) f.cover = String(args.cover);
  if (Array.isArray(args.badges)) f.badges = args.badges.map(String).filter(Boolean);
  if (Array.isArray(args.stats)) {
    f.stats = (args.stats as Json[])
      .map((s) => ({ num: String(s?.num ?? "").trim(), label: String(s?.label ?? "").trim() }))
      .filter((s: ReportStat) => s.num && s.label)
      .slice(0, 3);
  }
  if (args.edition !== undefined) f.edition = str(args, "edition") ?? null;
  if (args.edition_label !== undefined) f.editionLabel = str(args, "edition_label") ?? null;
  if (args.canva_url !== undefined) f.canvaUrl = str(args, "canva_url") ?? null;
  if (args.published_at !== undefined) {
    const d = String(args.published_at);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ReportError("published_at debe ser YYYY-MM-DD.");
    f.publishedAt = d;
  }
  return f;
}

// ─── Schemas ─────────────────────────────────────────────────

const CARD_PROPS: Json = {
  title: { type: "string", description: "Título visible en la tarjeta y en la página." },
  description: { type: "string", description: "Resumen de 1-3 frases para la tarjeta." },
  badges: { type: "array", items: { type: "string" }, description: "Etiquetas cortas, p. ej. [\"EnergyMap\", \"2026\"]." },
  stats: {
    type: "array",
    maxItems: 3,
    description: "Hasta 3 datos destacados para la tarjeta.",
    items: {
      type: "object",
      properties: { num: { type: "string" }, label: { type: "string" } },
      required: ["num", "label"],
    },
  },
  cover: {
    type: "string",
    enum: COVER_OPTIONS.map((c) => c.cls),
    description: "Color de la portada de la tarjeta. Por defecto accent-orange.",
  },
  edition: { type: "string", description: "Edición en números romanos (p. ej. IV), opcional." },
  edition_label: { type: "string", description: "Texto bajo la edición, p. ej. «Edición · Anual»." },
  canva_url: { type: "string", description: "Enlace a una presentación complementaria (opcional)." },
  published_at: { type: "string", description: "Fecha de publicación YYYY-MM-DD. Por defecto hoy." },
};

const CLIENT_PROP = {
  type: "string",
  description: "Slug (o nombre) del cliente. Usa list_clients si no lo sabes.",
};

// ─── Tools ───────────────────────────────────────────────────

export const TOOLS: ToolDef[] = [
  {
    name: "list_clients",
    title: "Listar clientes",
    description:
      "Lista los espacios de cliente: slug, nombre, nº de personas con acceso y nº de informes.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    async run(_args, ctx) {
      const admin = createAdminClient();
      const [{ data: clients }, { data: members }, { data: reports }] = await Promise.all([
        admin.from("clients").select("*").order("name"),
        admin.from("client_members").select("client_id"),
        admin.from("reports").select("client_id"),
      ]);
      const count = (rows: { client_id: string | null }[] | null, id: string | null) =>
        (rows ?? []).filter((r) => r.client_id === id).length;
      return {
        clients: ((clients ?? []) as Client[]).map((c) => ({
          slug: c.slug,
          name: c.name,
          members: count(members, c.id),
          reports: count(reports, c.id),
          space_url: `${ctx.origin}/c/${c.slug}`,
          admin_url: `${ctx.origin}/admin/${c.slug}`,
        })),
        public_reports: count(reports, null),
      };
    },
  },
  {
    name: "get_client",
    title: "Ver un cliente",
    description:
      "Detalle de un espacio de cliente: quién tiene acceso (y si ya ha entrado) y sus informes publicados.",
    inputSchema: {
      type: "object",
      properties: { client: CLIENT_PROP },
      required: ["client"],
    },
    annotations: { readOnlyHint: true },
    async run(args, ctx) {
      const client = await resolveClient(req(args, "client"));
      const admin = createAdminClient();
      const [{ data: members }, { data: reports }, { data: auth }] = await Promise.all([
        admin.from("client_members").select("email").eq("client_id", client.id).order("email"),
        admin
          .from("reports")
          .select("*")
          .eq("client_id", client.id)
          .order("published_at", { ascending: false }),
        admin.auth.admin.listUsers({ perPage: 1000 }),
      ]);
      const authByEmail = new Map(
        (auth?.users ?? []).map((u) => [u.email?.toLowerCase() ?? "", u])
      );
      return {
        client: {
          slug: client.slug,
          name: client.name,
          space_url: `${ctx.origin}/c/${client.slug}`,
          admin_url: `${ctx.origin}/admin/${client.slug}`,
        },
        members: (members ?? []).map((m) => {
          const u = authByEmail.get(m.email.toLowerCase());
          return {
            email: m.email,
            status: !u ? "email no enviado" : u.last_sign_in_at ? "ha entrado" : "invitación enviada",
          };
        }),
        reports: ((reports ?? []) as Report[]).map((r) => reportOut(r, ctx)),
      };
    },
  },
  {
    name: "list_public_reports",
    title: "Listar informes públicos",
    description: "Informes públicos de la landing (los que no pertenecen a ningún cliente).",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    async run(_args, ctx) {
      const { data } = await createAdminClient()
        .from("reports")
        .select("*")
        .eq("visibility", "public")
        .order("published_at", { ascending: false });
      return { reports: ((data ?? []) as Report[]).map((r) => reportOut(r, ctx)) };
    },
  },
  {
    name: "create_client",
    title: "Crear espacio de cliente",
    description:
      "Crea un espacio privado de cliente. No da acceso a nadie: usa add_member después.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre del cliente, p. ej. «Banco Sabadell»." },
        slug: { type: "string", description: "URL del espacio (/c/{slug}). Por defecto, a partir del nombre." },
        color: { type: "string", description: "Color de marca en hex, p. ej. #0066b3." },
        initials: { type: "string", description: "Iniciales (2-3 letras). Por defecto, las dos primeras del nombre." },
      },
      required: ["name"],
    },
    async run(args, ctx) {
      const name = req(args, "name");
      const slug = slugify(str(args, "slug") || name);
      const color = str(args, "color") || "#f26522";
      if (!/^#[0-9a-f]{6}$/i.test(color)) throw new ReportError("color debe ser un hex tipo #f26522.");
      const initials = (str(args, "initials")?.trim() || name.slice(0, 2)).toUpperCase().slice(0, 3);
      const { error } = await createAdminClient()
        .from("clients")
        .insert({ name, slug, color, initials });
      if (error) throw new ReportError(`No se pudo crear el cliente: ${error.message}`);
      return { slug, name, space_url: `${ctx.origin}/c/${slug}`, admin_url: `${ctx.origin}/admin/${slug}` };
    },
  },
  {
    name: "add_member",
    title: "Dar acceso a una persona",
    description:
      "Da acceso a un email al espacio de un cliente y le ENVÍA en el momento el email de acceso de " +
      "Happyforce. Es una acción visible para el cliente: confirma el email y el cliente con el usuario antes.",
    inputSchema: {
      type: "object",
      properties: {
        client: CLIENT_PROP,
        email: { type: "string", description: "Email de la persona." },
      },
      required: ["client", "email"],
    },
    annotations: { openWorldHint: true },
    async run(args) {
      const client = await resolveClient(req(args, "client"));
      const { email, alreadyRegistered } = await addMember(client.id, req(args, "email"));
      return {
        client: client.slug,
        email,
        result: alreadyRegistered
          ? "Acceso dado. Ya tenía cuenta: puede entrar con su email (no se envió email nuevo)."
          : "Acceso dado y email de acceso enviado.",
      };
    },
  },
  {
    name: "prepare_upload",
    title: "Preparar la subida de un fichero",
    description:
      "Paso 1 para publicar un fichero (.html, .pdf, .mp4, .webm, .mov). Devuelve una URL firmada " +
      "(válida 2 h) y el comando curl para subir el fichero local directamente al almacenamiento. " +
      "Ejecuta el comando con la ruta real del fichero y, cuando termine bien, llama a publish_report " +
      "(o update_report) con el staged_path devuelto.",
    inputSchema: {
      type: "object",
      properties: {
        file_name: { type: "string", description: "Nombre del fichero local con extensión, p. ej. energymap-q3.mp4." },
      },
      required: ["file_name"],
    },
    async run(args) {
      const fileName = req(args, "file_name");
      const up = await createStagedUpload(fileName);
      return {
        staged_path: up.stagedPath,
        kind: up.kind,
        content_type: up.contentType,
        expires_in_seconds: up.expiresInSeconds,
        upload_url: up.uploadUrl,
        upload_command: `curl --fail-with-body -sS -T "<RUTA_DEL_FICHERO>" -H "Content-Type: ${up.contentType}" "${up.uploadUrl}"`,
        next_step: "Sustituye <RUTA_DEL_FICHERO>, ejecuta el comando y luego llama a publish_report con staged_path.",
      };
    },
  },
  {
    name: "publish_report",
    title: "Publicar un informe",
    description:
      "Publica un informe nuevo en el espacio de un cliente (o en la landing pública si no se indica " +
      "cliente). Contenido: staged_path de un fichero ya subido con prepare_upload, o external_url para " +
      "un enlace. Publicar en un espacio lo hace visible para el cliente: confirma título, cliente y " +
      "fichero con el usuario antes.",
    inputSchema: {
      type: "object",
      properties: {
        client: {
          type: "string",
          description: "Slug (o nombre) del cliente. Omítelo SOLO para un informe público en la landing.",
        },
        staged_path: { type: "string", description: "Devuelto por prepare_upload tras subir el fichero." },
        external_url: { type: "string", description: "En lugar de un fichero: enlace externo (Drive, etc.)." },
        slug: { type: "string", description: "URL del informe (/r/{slug}). Por defecto, a partir del título." },
        replace: {
          type: "boolean",
          description: "true para sustituir un informe existente con el mismo slug. Por defecto false.",
        },
        ...CARD_PROPS,
      },
      required: ["title"],
    },
    annotations: { openWorldHint: true },
    async run(args, ctx) {
      const clientRef = str(args, "client")?.trim();
      const client = clientRef ? await resolveClient(clientRef) : null;
      const stagedPath = str(args, "staged_path")?.trim() || null;
      const externalUrl = str(args, "external_url")?.trim() || null;
      if (!!stagedPath === !!externalUrl) {
        throw new ReportError("Indica exactamente uno: staged_path (fichero) o external_url (enlace).");
      }
      const report = await createReport(
        {
          ...readFields(args),
          title: req(args, "title"),
          clientId: client?.id ?? null,
          slug: str(args, "slug"),
          stagedPath,
          externalUrl,
          replace: args.replace === true,
        },
        ctx.email
      );
      return {
        ...reportOut(report, ctx),
        published_in: client ? `espacio privado de ${client.name}` : "landing pública",
        ...(client ? { space_url: `${ctx.origin}/c/${client.slug}` } : {}),
      };
    },
  },
  {
    name: "update_report",
    title: "Editar un informe",
    description:
      "Cambia la tarjeta de un informe existente (solo los campos que pases), lo mueve de espacio, o " +
      "sustituye su contenido por un fichero nuevo (staged_path) o un enlace (external_url). La URL " +
      "/r/{slug} no cambia.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Slug del informe a editar." },
        client: {
          type: "string",
          description: "Mover a este cliente (slug o nombre), o «public» para la landing. Omítelo para no moverlo.",
        },
        staged_path: { type: "string", description: "Sustituir el contenido por este fichero subido con prepare_upload." },
        external_url: { type: "string", description: "Sustituir el contenido por este enlace externo." },
        ...CARD_PROPS,
      },
      required: ["slug"],
    },
    async run(args, ctx) {
      const slug = req(args, "slug");
      const { data: existing } = await createAdminClient()
        .from("reports")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) throw new ReportError(`No existe ningún informe con slug «${slug}».`);
      const clientRef = str(args, "client")?.trim();
      let clientId: string | null | undefined;
      if (clientRef) {
        clientId = clientRef.toLowerCase() === "public" ? null : (await resolveClient(clientRef)).id;
      }
      const stagedPath = str(args, "staged_path")?.trim() || null;
      const externalUrl = str(args, "external_url")?.trim() || null;
      if (stagedPath && externalUrl) {
        throw new ReportError("Indica staged_path o external_url, no los dos.");
      }
      const report = await updateReport(existing.id, {
        ...readFields(args),
        clientId,
        stagedPath,
        externalUrl,
      });
      return reportOut(report, ctx);
    },
  },
];

export const SERVER_INSTRUCTIONS = `Plataforma de informes de Happyforce (informes.myhappyforce.com). Customer Advisory comparte aquí informes con clientes: cada cliente tiene un espacio privado (/c/{slug}) al que solo entran los emails con acceso (login por enlace mágico), y cada informe vive en /r/{slug}. Tipos: HTML autocontenido, PDF, vídeo (MP4) o enlace externo.

Publicar un fichero:
1. prepare_upload con el nombre del fichero.
2. Ejecuta en el terminal el upload_command sustituyendo la ruta local (necesitas un terminal: Claude Code o la pestaña Code de Claude Desktop).
3. publish_report con el staged_path, el cliente y los datos de la tarjeta (título, descripción breve, badges, hasta 3 stats). Para un HTML, saca título, descripción y datos clave del propio fichero. Para un nuevo informe del mismo tipo que otro existente, imita su estilo de tarjeta.
Para sustituir el fichero de un informe existente: prepare_upload + subida + update_report con staged_path.

Vídeos: mejor MP4 (H.264 + AAC) con faststart, por debajo de 50 MB. Si pesa más o es .mov, propón comprimirlo antes con ffmpeg:
ffmpeg -i entrada.mov -c:v libx264 -crf 23 -preset medium -vf "scale=-2:'min(1080,ih)'" -c:a aac -b:a 128k -movflags +faststart salida.mp4

Antes de cualquier acción que vea el cliente (publish_report en un espacio, add_member, que envía un email), resume lo que vas a hacer y espera el sí del usuario. Al terminar, da el enlace /r/{slug} y el del espacio. Quitar accesos y borrar informes o clientes no está disponible aquí: se hace en el panel /admin.`;
