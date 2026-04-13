/**
 * Named agent connectors — multiple Bearer tokens per user (per cloud, on-prem, etc.).
 *
 * GET  — session: list connectors (no secret values)
 * POST — session: body `{ name: string, metadata?: Record<string, unknown> }` — returns `token` once
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

function generateToken(): string {
  const buf = new Uint8Array(48);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.agentToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      metadata: true,
      lastSeenAt: true,
      lastSeenVersion: true,
      lastSeenLabels: true,
      lastSeenSource: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    connectors: rows.map((r) => ({
      id: r.id,
      name: r.name,
      metadata: r.metadata,
      lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
      lastSeenVersion: r.lastSeenVersion,
      lastSeenSource: r.lastSeenSource,
      createdAt: r.createdAt.toISOString(),
    })),
    accountToken: Boolean(user.agentToken),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; metadata?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) {
    return NextResponse.json({ error: "name is required (max 120 chars)" }, { status: 400 });
  }

  let metadata: Prisma.InputJsonValue = {};
  if (body.metadata !== undefined) {
    if (body.metadata === null || typeof body.metadata !== "object" || Array.isArray(body.metadata)) {
      return NextResponse.json({ error: "metadata must be a JSON object when provided" }, { status: 400 });
    }
    metadata = body.metadata as Prisma.InputJsonValue;
  }

  const token = generateToken();
  const row = await db.agentToken.create({
    data: {
      userId: user.id,
      name,
      token,
      metadata,
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    connector: row,
    token,
    message: "Store this token securely — it is only shown once.",
  });
}
