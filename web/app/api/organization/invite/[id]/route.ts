import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { resolveRouteParamId } from "@/lib/server/route-params";
import { recordWorkspaceAuditEvent } from "@/lib/audit/workspace-audit";

async function getOwnedOrg(userId: string) {
  return db.organization.findUnique({
    where: { ownerUserId: userId },
    select: { id: true },
  });
}

type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOwnedOrg(user.id);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const id = await resolveRouteParamId(ctx.params);
  const invite = await db.organizationInvite.findFirst({
    where: { id, organizationId: org.id, acceptedAt: null },
    select: { id: true, email: true },
  });
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  await db.organizationInvite.deleteMany({
    where: { id: invite.id, organizationId: org.id, acceptedAt: null },
  });

  await recordWorkspaceAuditEvent({
    userId: user.id,
    organizationId: org.id,
    actorEmail: user.email,
    action: "team.invite_revoked",
    detail: { email: invite.email },
  });

  return NextResponse.json({ ok: true });
}
