import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { mergeConnectionSecretsEnc } from "@/lib/elt/connection-secrets-store";
import { toPublicConnection } from "@/lib/elt/connection-public";

export async function GET() {
  const user = await getCurrentDbUser();
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
        createdAt: true,
        updatedAt: true,
        connectionSecretsEnc: true,
      },
    });
    return NextResponse.json({
      connections: rows.map((r) => toPublicConnection(r)),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("P2021")) {
      return NextResponse.json({ connections: [], _migrationPending: true });
    }
    if (msg.includes("connection_secrets_enc") || msg.includes("Unknown column") || msg.includes("P2022")) {
      return NextResponse.json(
        {
          connections: [],
          _migrationPending: true,
          _hint: "Run prisma/add-connection-secrets-enc.sql or npx prisma db push to add connection_secrets_enc",
        },
        { status: 200 }
      );
    }
    throw err;
  }
}

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const { name, connectionType, connector, config } = b;
  if (
    typeof name !== "string" || !name.trim() ||
    typeof connectionType !== "string" || !["source", "destination"].includes(connectionType) ||
    typeof connector !== "string" || !connector.trim()
  ) {
    return NextResponse.json({ error: "name, connectionType (source|destination), and connector are required" }, { status: 400 });
  }

  let connectionSecretsEnc: string | null = null;
  if (b.secrets !== undefined && b.secrets !== null) {
    if (typeof b.secrets !== "object" || Array.isArray(b.secrets)) {
      return NextResponse.json({ error: "secrets must be an object of string values or null" }, { status: 400 });
    }
    try {
      connectionSecretsEnc = mergeConnectionSecretsEnc(
        null,
        b.secrets as Record<string, string>,
        connectionType as "source" | "destination",
        connector.trim()
      );
    } catch {
      return NextResponse.json(
        { error: "Could not encrypt secrets — set ELTPULSE_TOKEN_ENCRYPTION_KEY (32-byte base64) on the server" },
        { status: 503 }
      );
    }
  }

  try {
    const connection = await db.connection.create({
      data: {
        userId: user.id,
        name: name.trim(),
        connectionType,
        connector: connector.trim(),
        config: (config && typeof config === "object" && !Array.isArray(config) ? config : {}) as Prisma.InputJsonValue,
        ...(connectionSecretsEnc !== null ? { connectionSecretsEnc } : {}),
      },
    });
    return NextResponse.json({ connection: toPublicConnection(connection) }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "A connection with that name already exists" }, { status: 409 });
    }
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("P2021")) {
      return NextResponse.json({ error: "Database migration pending — run the add-connections.sql migration first" }, { status: 503 });
    }
    if (msg.includes("connection_secrets_enc") || msg.includes("Unknown column") || msg.includes("P2022")) {
      return NextResponse.json(
        { error: "Add column connection_secrets_enc (see prisma/add-connection-secrets-enc.sql) or run prisma db push" },
        { status: 503 }
      );
    }
    throw err;
  }
}
