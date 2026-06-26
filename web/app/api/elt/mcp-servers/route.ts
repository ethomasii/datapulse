import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getWorkspacePermissions, workspaceResourceUserId } from "@/lib/auth/org-permissions";
import { db } from "@/lib/db/client";
import { mergeMcpSecretsEnc } from "@/lib/elt/mcp-server/secrets-store";
import { toPublicMcpServer } from "@/lib/elt/mcp-server/public";
import type { McpTransport } from "@/lib/elt/mcp-server/types";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.CONNECTIONS_READ)) return scopeForbiddenResponse();

  const ownerIds = (await getWorkspacePermissions(auth.user.id)).resourceOwnerIds;

  try {
    const rows = await db.mcpServer.findMany({
      where: { userId: { in: ownerIds } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ servers: rows.map(toPublicMcpServer) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("McpServer") && (msg.includes("does not exist") || msg.includes("P2021"))) {
      return NextResponse.json({ servers: [], _migrationPending: true });
    }
    throw err;
  }
}

export async function POST(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.CONNECTIONS_WRITE)) return scopeForbiddenResponse();

  const perms = await getWorkspacePermissions(auth.user.id);
  if (!perms.canWrite) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const transport = typeof b.transport === "string" ? b.transport.trim() : "";
  if (!name || !["stdio", "http", "sse"].includes(transport)) {
    return NextResponse.json(
      { error: "name and transport (stdio|http|sse) are required" },
      { status: 400 }
    );
  }

  let secretsEnc: string | null = null;
  if (b.secrets !== undefined && b.secrets !== null) {
    if (typeof b.secrets !== "object" || Array.isArray(b.secrets)) {
      return NextResponse.json({ error: "secrets must be an object" }, { status: 400 });
    }
    try {
      secretsEnc = mergeMcpSecretsEnc(null, b.secrets as Record<string, string>);
    } catch {
      return NextResponse.json(
        { error: "Could not encrypt secrets — set ELTPULSE_TOKEN_ENCRYPTION_KEY" },
        { status: 503 }
      );
    }
  }

  const row = await db.mcpServer.create({
    data: {
      userId: workspaceResourceUserId(perms, auth.user.id),
      name,
      description: typeof b.description === "string" ? b.description.trim() || null : null,
      transport: transport as McpTransport,
      config: (b.config && typeof b.config === "object" && !Array.isArray(b.config)
        ? b.config
        : {}) as Prisma.InputJsonValue,
      secretsEnc,
    },
  });

  return NextResponse.json({ server: toPublicMcpServer(row) }, { status: 201 });
}
