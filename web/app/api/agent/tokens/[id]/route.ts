/**
 * DELETE /api/agent/tokens/:id — revoke a named connector (soft revoke).
 */
import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const raw = id?.trim();
  if (!raw) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const row = await db.agentToken.findFirst({
    where: { id: raw, userId: user.id, revokedAt: null },
    select: { id: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Connector not found or already revoked" }, { status: 404 });
  }

  await db.agentToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
