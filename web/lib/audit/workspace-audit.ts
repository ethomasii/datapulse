import { db } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

export type AuditEventRow = {
  id: string;
  actorEmail: string;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export async function recordWorkspaceAuditEvent(input: {
  userId: string;
  actorEmail: string;
  action: string;
  organizationId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.workspaceAuditEvent.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId ?? null,
        actorEmail: input.actorEmail,
        action: input.action,
        detail: (input.detail ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch {
    /* table may not be migrated yet */
  }
}

/** Events for workspace owner + org members (shared org audit trail). */
export async function listWorkspaceAuditEvents(userId: string, limit = 100): Promise<AuditEventRow[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      organizationId: true,
      ownedOrganization: { select: { id: true } },
    },
  });
  if (!user) return [];

  const orgId = user.ownedOrganization?.id ?? user.organizationId;

  try {
    const rows = await db.workspaceAuditEvent.findMany({
      where: orgId
        ? {
            OR: [{ userId }, { organizationId: orgId }],
          }
        : { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        actorEmail: true,
        action: true,
        detail: true,
        createdAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      actorEmail: r.actorEmail,
      action: r.action,
      detail: (r.detail as Record<string, unknown>) ?? {},
      createdAt: r.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}
