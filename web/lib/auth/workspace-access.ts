import { db } from "@/lib/db/client";

/** User ids whose pipelines, runs, and connections this account may access. */
export async function getAccessibleResourceOwnerIds(userId: string): Promise<string[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  const ids = new Set<string>([userId]);
  if (user?.organizationId) {
    const org = await db.organization.findUnique({
      where: { id: user.organizationId },
      select: { ownerUserId: true },
    });
    if (org?.ownerUserId) ids.add(org.ownerUserId);
  }
  return Array.from(ids);
}

export function pipelineOwnerWhere(ownerIds: string[]) {
  return { userId: { in: ownerIds } };
}
