import { db } from "@/lib/db/client";

export type WorkspaceRole = "owner" | "member" | "viewer" | "solo";

export type WorkspacePermissions = {
  role: WorkspaceRole;
  canWrite: boolean;
  canManageTeam: boolean;
  canManageBilling: boolean;
  resourceOwnerIds: string[];
};

export async function getWorkspacePermissions(userId: string): Promise<WorkspacePermissions> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      organizationId: true,
      ownedOrganization: { select: { id: true } },
    },
  });
  if (!user) {
    return {
      role: "solo",
      canWrite: true,
      canManageTeam: false,
      canManageBilling: true,
      resourceOwnerIds: [userId],
    };
  }

  if (user.ownedOrganization) {
    return {
      role: "owner",
      canWrite: true,
      canManageTeam: true,
      canManageBilling: true,
      resourceOwnerIds: [userId],
    };
  }

  if (user.organizationId) {
    const org = await db.organization.findUnique({
      where: { id: user.organizationId },
      select: { ownerUserId: true },
    });
    const invite = await db.organizationInvite.findFirst({
      where: {
        organizationId: user.organizationId,
        email: user.email.trim().toLowerCase(),
        acceptedAt: { not: null },
      },
      select: { role: true },
    });
    const inviteRole = invite?.role ?? "member";
    const isViewer = inviteRole === "viewer";
    const ownerIds = org?.ownerUserId ? [org.ownerUserId, userId] : [userId];
    return {
      role: isViewer ? "viewer" : "member",
      canWrite: !isViewer,
      canManageTeam: false,
      canManageBilling: false,
      resourceOwnerIds: Array.from(new Set(ownerIds)),
    };
  }

  return {
    role: "solo",
    canWrite: true,
    canManageTeam: false,
    canManageBilling: true,
    resourceOwnerIds: [userId],
  };
}

/** User id that owns shared workspace resources (connections, pipelines). */
export function workspaceResourceUserId(perms: WorkspacePermissions, userId: string): string {
  if (perms.role === "member" || perms.role === "viewer") {
    return perms.resourceOwnerIds.find((id) => id !== userId) ?? userId;
  }
  return userId;
}
