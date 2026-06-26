import { getUserFromAgentToken } from "@/lib/agent/auth";
import { db } from "@/lib/db/client";
import { parseStoredMcpSecrets } from "@/lib/elt/mcp-server/secrets-store";
import type { McpServerConfig } from "@/lib/elt/mcp-server/types";
import { NextResponse } from "next/server";

/** GET /api/agent/mcp-servers — gateway/worker resolves MCP configs with secrets. */
export async function GET(req: Request) {
  const user = await getUserFromAgentToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db.mcpServer.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });

    const servers = rows.map((r) => ({
      id: r.id,
      name: r.name,
      transport: r.transport,
      config: (r.config ?? {}) as McpServerConfig,
      secrets: parseStoredMcpSecrets(r.secretsEnc),
      toolsCache: r.toolsCache,
      toolsCachedAt: r.toolsCachedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({ servers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("McpServer") && msg.includes("does not exist")) {
      return NextResponse.json({ servers: [], _migrationPending: true });
    }
    throw e;
  }
}
