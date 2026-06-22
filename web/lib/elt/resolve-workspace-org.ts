import { db } from "@/lib/db/client";

/** Resolve org workspace id for a run (session org wins, then membership, then owned org). */
export async function resolveWorkspaceOrganizationId(
  userId: string,
  sessionOrganizationId?: string | null
): Promise<string | null> {
  if (sessionOrganizationId?.trim()) return sessionOrganizationId.trim();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      organizationId: true,
      ownedOrganization: { select: { id: true } },
    },
  });
  if (!user) return null;
  return user.ownedOrganization?.id ?? user.organizationId ?? null;
}
