import { NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/api-tokens";
import { verifyOAuthAccessToken } from "@/lib/oauth";
import { ReportError } from "@/lib/reports";
import { SERVER_INSTRUCTIONS, TOOLS, type ToolContext } from "@/lib/mcp/tools";

/**
 * MCP server for Claude (Claude Code / Claude Desktop), Streamable HTTP
 * transport in its stateless, JSON-response form: every POST carries one
 * JSON-RPC message (or a batch) and gets a plain JSON reply. No sessions, no
 * SSE — nothing here needs server→client streaming.
 *
 * Auth (Authorization: Bearer …):
 *  - hfo_… OAuth access token: the organization connector in claude.ai (each
 *    member clicks "Connect" once). Discovery via /.well-known/… (see
 *    next.config rewrites) and the WWW-Authenticate header on 401.
 *  - hfi_… personal token created in /admin/claude (manual setup).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

type RpcId = string | number | null;
interface RpcMessage {
  jsonrpc?: string;
  id?: RpcId;
  method?: string;
  params?: Record<string, unknown>;
}

const rpcResult = (id: RpcId, result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: RpcId, code: number, message: string) => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

async function handle(msg: RpcMessage, ctx: ToolContext) {
  const id = msg.id ?? null;
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return rpcResult(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "informes-happyforce", title: "Informes Happyforce", version: "1.0.0" },
        instructions: SERVER_INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, {
        tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({
          name,
          title,
          description,
          inputSchema,
          ...(annotations ? { annotations } : {}),
        })),
      });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return rpcError(id, -32602, `Herramienta desconocida: ${name}`);
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const out = await tool.run(args, ctx);
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
        });
      } catch (e) {
        const message =
          e instanceof ReportError || e instanceof Error ? e.message : "Error inesperado";
        if (!(e instanceof ReportError)) console.error(`[mcp] ${name}`, e);
        return rpcResult(id, { content: [{ type: "text", text: message }], isError: true });
      }
    }
    default:
      return rpcError(id, -32601, `Método no soportado: ${msg.method}`);
  }
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;
  const email = token?.startsWith("hfo_")
    ? await verifyOAuthAccessToken(token)
    : await verifyApiToken(token);
  if (!email) {
    const origin = new URL(request.url).origin;
    return NextResponse.json(
      rpcError(
        null,
        -32001,
        "No autorizado: conecta el conector «Informes Happyforce» en Claude (Ajustes → Conectores)."
      ),
      {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer realm="informes", resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, "JSON no válido"), { status: 400 });
  }

  const ctx: ToolContext = { email, origin: new URL(request.url).origin };
  const messages = (Array.isArray(body) ? body : [body]) as RpcMessage[];
  const replies = [];
  for (const m of messages) {
    // Notifications (no id) and client responses get no reply.
    if (m && typeof m === "object" && m.method && m.id !== undefined) {
      replies.push(await handle(m, ctx));
    }
  }
  if (replies.length === 0) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? replies : replies[0]);
}

// Stateless server: no SSE stream to open (GET) and no session to end (DELETE).
function notAllowed() {
  return new NextResponse("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
export async function GET() {
  return notAllowed();
}
export async function DELETE() {
  return notAllowed();
}
