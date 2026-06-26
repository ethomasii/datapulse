import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import { db } from "@/lib/db/client";
import { discoverMcpTools } from "@/lib/elt/mcp-server/discover-tools";
import { toPublicMcpServer } from "@/lib/elt/mcp-server/public";
import { mcpSecretsForServer } from "@/lib/elt/mcp-server/resolve";
import { mergeMcpSecretsEnc } from "@/lib/elt/mcp-server/secrets-store";
import type { McpServerConfig, McpTransport } from "@/lib/elt/mcp-server/types";

type Ctx = { params: Promise<{ id: string }> };

async function loadServer(id: string, ownerIds: string[]) {
  return db.mcpServer.findFirst({ where: { id, userId: { in: ownerIds } } });
}

export async function GET(req: Request, ctx: Ctx) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.CONNECTIONS_READ)) return scopeForbiddenResponse();

  const { id } = await ctx.params;
  const ownerIds = (await getWorkspacePermissions(auth.user.id)).resourceOwnerIds;
  const row = await loadServer(id, ownerIds);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ server: toPublicMcpServer(row) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.CONNECTIONS_WRITE)) return scopeForbiddenResponse();

  const perms = await getWorkspacePermissions(auth.user.id);
  if (!perms.canWrite) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id } = await ctx.params;
  const ownerIds = perms.resourceOwnerIds;
  const existing = await loadServer(id, ownerIds);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  let secretsEnc = existing.secretsEnc;
  if (b.secrets !== undefined) {
    if (b.secrets !== null && (typeof b.secrets !== "object" || Array.isArray(b.secrets))) {
      return NextResponse.json({ error: "secrets must be an object or null" }, { status: 400 });
    }
    try {
      secretsEnc = mergeMcpSecretsEnc(
        existing.secretsEnc,
        b.secrets === null ? null : (b.secrets as Record<string, string>)
      );
    } catch {
      return NextResponse.json({ error: "Could not encrypt secrets" }, { status: 503 });
    }
  }

  const row = await db.mcpServer.update({
    where: { id: existing.id },
    data: {
      ...(typeof b.name === "string" && b.name.trim() ? { name: b.name.trim() } : {}),
      ...(typeof b.description === "string" ? { description: b.description.trim() || null } : {}),
      ...(typeof b.transport === "string" && ["stdio", "http", "sse"].includes(b.transport)
        ? { transport: b.transport as McpTransport }
        : {}),
      ...(b.config && typeof b.config === "object" && !Array.isArray(b.config)
        ? { config: b.config as Prisma.InputJsonValue }
        : {}),
      secretsEnc,
    },
  });

  return NextResponse.json({ server: toPublicMcpServer(row) });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.CONNECTIONS_WRITE)) return scopeForbiddenResponse();

  const perms = await getWorkspacePermissions(auth.user.id);
  if (!perms.canWrite) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id } = await ctx.params;
  const row = await loadServer(id, perms.resourceOwnerIds);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.mcpServer.delete({ where: { id: row.id } });
  return NextResponse.json({ ok: true });
}

/** POST discover tools and refresh cache */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.CONNECTIONS_WRITE)) return scopeForbiddenResponse();

  const { id } = await ctx.params;
  const ownerIds = (await getWorkspacePermissions(auth.user.id)).resourceOwnerIds;
  const row = await loadServer(id, ownerIds);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = (row.config ?? {}) as McpServerConfig;
  const secrets = await mcpSecretsForServer(row);

  try {
    const tools = await discoverMcpTools({
      name: row.name,
      transport: row.transport as McpTransport,
      config,
      secrets,
    });

    const updated = await db.mcpServer.update({
      where: { id: row.id },
      data: { toolsCache: tools as Prisma.InputJsonValue, toolsCachedAt: new Date() },
    });

    return NextResponse.json({ server: toPublicMcpServer(updated), tools });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
