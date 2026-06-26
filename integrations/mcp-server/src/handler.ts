import { randomUUID } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createClient, extractBearerToken } from "./client.js";
import { createEltPulseMcpServer } from "./server.js";

export const MCP_SERVER_VERSION = "0.1.0";

type McpSession = {
  transport: WebStandardStreamableHTTPServerTransport;
  server: ReturnType<typeof createEltPulseMcpServer>;
};

/** In-memory sessions — sticky on warm serverless instances. */
const sessions = new Map<string, McpSession>();

export function resolveApiTokenFromRequest(request: Request): string | null {
  const fromHeader = extractBearerToken(request.headers.get("authorization") ?? undefined);
  if (fromHeader?.startsWith("elt_")) return fromHeader;
  return null;
}

export function mcpUnauthorizedResponse(baseUrl = "https://eltpulse.dev"): Response {
  return Response.json(
    {
      error: "Unauthorized",
      hint: "Send Authorization: Bearer elt_... (Workspace API key from Account → Developers).",
      docsUrl: `${baseUrl}/docs`,
    },
    { status: 401 }
  );
}

export function mcpInfoResponse(baseUrl = "https://eltpulse.dev"): Response {
  return Response.json({
    name: "eltPulse MCP",
    version: MCP_SERVER_VERSION,
    transport: "streamable-http",
    protocol: "Model Context Protocol (Streamable HTTP + SSE)",
    endpoint: "/",
    authentication: {
      type: "Bearer",
      header: "Authorization: Bearer elt_...",
      note: "Workspace API key from Account → Developers.",
    },
    documentationUrl: `${baseUrl}/docs`,
    health: "/health",
  });
}

export function mcpHealthResponse(): Response {
  return Response.json({ ok: true, service: "eltpulse-mcp", version: MCP_SERVER_VERSION });
}

function isMcpProtocolRequest(request: Request): boolean {
  if (request.headers.get("mcp-protocol-version")) return true;
  if (request.headers.get("mcp-session-id")) return true;
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/event-stream")) return true;
  if (request.method === "POST" || request.method === "DELETE") return true;
  return false;
}

async function createSession(apiToken: string): Promise<McpSession> {
  const client = createClient(apiToken);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessionclosed: (sessionId) => {
      sessions.delete(sessionId);
    },
  });
  const server = createEltPulseMcpServer(client);
  await server.connect(transport);

  transport.onclose = () => {
    const id = transport.sessionId;
    if (id) sessions.delete(id);
    void server.close();
  };

  return { transport, server };
}

export async function handleMcpHttpRequest(request: Request, apiToken: string): Promise<Response> {
  const sessionId = request.headers.get("mcp-session-id") ?? undefined;

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    return session.transport.handleRequest(request);
  }

  if (sessionId && !sessions.has(sessionId)) {
    return Response.json({ error: "Unknown MCP session." }, { status: 404 });
  }

  const session = await createSession(apiToken);
  const response = await session.transport.handleRequest(request);

  if (session.transport.sessionId) {
    sessions.set(session.transport.sessionId, session);
  }

  return response;
}

export async function handleMcpRoute(request: Request): Promise<Response> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://eltpulse.dev").replace(/\/$/, "");

  if (request.method === "GET" && !isMcpProtocolRequest(request)) {
    return mcpInfoResponse(baseUrl);
  }

  const token = resolveApiTokenFromRequest(request);
  if (!token) {
    return mcpUnauthorizedResponse(baseUrl);
  }

  return handleMcpHttpRequest(request, token);
}
