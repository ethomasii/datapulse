/**
 * GET /api/agent/connections
 *
 * Lists connection profiles with decrypted secret env keys for the self-hosted agent only.
 * Authenticated by Bearer agentToken (same as /api/agent/pipelines/*).
 */
import { NextResponse } from "next/server";
import { getUserFromAgentToken } from "@/lib/agent/auth";
import { db } from "@/lib/db/client";
import { parseStoredConnectionSecrets } from "@/lib/elt/connection-secrets-store";

export async function GET(req: Request) {
  const user = await getUserFromAgentToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db.connection.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        connectionType: true,
        connector: true,
        config: true,
        connectionSecretsEnc: true,
      },
    });

    const connections = rows.map((r) => {
      const { connectionSecretsEnc, ...rest } = r;
      return {
        ...rest,
        secrets: parseStoredConnectionSecrets(connectionSecretsEnc),
      };
    });

    return NextResponse.json({ connections });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("connection_secrets_enc") || msg.includes("Unknown column") || msg.includes("P2022")) {
      return NextResponse.json(
        { error: "Database column connection_secrets_enc missing — apply prisma/add-connection-secrets-enc.sql or run prisma db push" },
        { status: 503 }
      );
    }
    throw e;
  }
}
