import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { mergeConnectionSecretsEnc } from "@/lib/elt/connection-secrets-store";
import { toPublicConnection } from "@/lib/elt/connection-public";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.connection.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      connectionType: true,
      connector: true,
      connectionSecretsEnc: true,
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const { name, config } = b;

  const data: Prisma.ConnectionUpdateManyMutationInput = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (config && typeof config === "object" && !Array.isArray(config)) {
    data.config = config as Prisma.InputJsonValue;
  }

  if ("secrets" in b) {
    if (b.secrets === null) {
      data.connectionSecretsEnc = null;
    } else if (typeof b.secrets === "object" && !Array.isArray(b.secrets)) {
      const patch = b.secrets as Record<string, string>;
      if (Object.keys(patch).length > 0) {
        try {
          const nextEnc = mergeConnectionSecretsEnc(
            existing.connectionSecretsEnc,
            patch,
            existing.connectionType as "source" | "destination",
            existing.connector
          );
          data.connectionSecretsEnc = nextEnc;
        } catch {
          return NextResponse.json(
            { error: "Could not encrypt secrets — set DATAPULSE_TOKEN_ENCRYPTION_KEY on the server" },
            { status: 503 }
          );
        }
      }
    }
  }

  if (Object.keys(data).length === 0) {
    const row = await db.connection.findFirst({ where: { id, userId: user.id } });
    return NextResponse.json({ connection: row ? toPublicConnection(row) : null });
  }

  const count = await db.connection.updateMany({
    where: { id, userId: user.id },
    data,
  });
  if (count.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const connection = await db.connection.findFirst({ where: { id, userId: user.id } });
  return NextResponse.json({ connection: connection ? toPublicConnection(connection) : null });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const res = await db.connection.deleteMany({ where: { id, userId: user.id } });
  if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
