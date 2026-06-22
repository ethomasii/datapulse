import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { resolveUserPlanTier, tierAllowsOrgInvites } from "@/lib/plans/tier-features";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownedOrg = await db.organization.findUnique({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      name: true,
      members: {
        select: { id: true, email: true, name: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      invites: {
        where: { acceptedAt: null },
        select: { id: true, email: true, role: true, invitedAt: true },
        orderBy: { invitedAt: "desc" },
      },
    },
  });

  if (ownedOrg) {
    const tier = await resolveUserPlanTier(user.id);
    return NextResponse.json({
      role: "owner" as const,
      organization: { id: ownedOrg.id, name: ownedOrg.name },
      members: ownedOrg.members,
      pendingInvites: ownedOrg.invites,
      planTier: tier,
      canInvite: tierAllowsOrgInvites(tier),
    });
  }

  if (user.organizationId) {
    const org = await db.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        name: true,
        owner: { select: { id: true, email: true, name: true } },
        members: {
          select: { id: true, email: true, name: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (org) {
      return NextResponse.json({
        role: "member" as const,
        organization: { id: org.id, name: org.name },
        owner: org.owner,
        members: org.members,
        pendingInvites: [],
      });
    }
  }

  return NextResponse.json({
    role: null,
    organization: null,
    members: [],
    pendingInvites: [],
  });
}
