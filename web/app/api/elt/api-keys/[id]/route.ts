import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { recordWorkspaceAuditEvent } from "@/lib/audit/workspace-audit";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = await db.workspaceApiKey.findFirst({
    where: { id, userId: user.id, revokedAt: null },
    select: { id: true, name: true, keyPrefix: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.workspaceApiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  await recordWorkspaceAuditEvent({
    userId: user.id,
    actorEmail: user.email,
    action: "api_key.revoked",
    detail: { name: row.name, keyPrefix: row.keyPrefix },
  });

  return NextResponse.json({ ok: true });
}
