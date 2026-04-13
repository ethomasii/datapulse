import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";

/**
 * Active org workspace for the current session: Clerk org when present, else the member’s DB `organizationId`.
 * User must own the org or be a member.
 */
export async function getActiveOrganizationForSession(): Promise<{
  id: string;
  ownerUserId: string;
} | null> {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, organizationId: true },
  });
  if (!user) return null;

  if (clerkOrgId) {
    const org = await db.organization.findFirst({
      where: {
        clerkOrgId,
        OR: [{ ownerUserId: user.id }, { members: { some: { id: user.id } } }],
      },
      select: { id: true, ownerUserId: true },
    });
    return org;
  }

  if (user.organizationId) {
    return db.organization.findFirst({
      where: {
        id: user.organizationId,
        OR: [{ ownerUserId: user.id }, { members: { some: { id: user.id } } }],
      },
      select: { id: true, ownerUserId: true },
    });
  }

  return null;
}
