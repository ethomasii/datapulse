import { db } from "@/lib/db/client";

export type WorkspaceRole = "owner" | "member" | "viewer" | "catalog_editor" | "catalog_browser" | "solo";

/** Who may browse catalog entries/assets in the workspace. */
export type CatalogVisibility = "full" | "public_only";

export type WorkspacePermissions = {
  role: WorkspaceRole;
  /** Create/edit pipelines, connections, runs, canvas saves. */
  canWrite: boolean;
  /** Edit catalog metadata (description, tags) without full pipeline write. */
  canEditCatalog: boolean;
  canManageTeam: boolean;
  canManageBilling: boolean;
  resourceOwnerIds: string[];
  /** When `public_only`, catalog reads filter to public-tagged entries. */
  catalogVisibility: CatalogVisibility;
};

type InviteRole = "member" | "viewer" | "catalog_editor" | "catalog_browser";

function permissionsFromInviteRole(
  inviteRole: string,
  ownerIds: string[]
): Omit<WorkspacePermissions, "canManageTeam" | "canManageBilling"> & {
  role: WorkspaceRole;
} {
  const role = (["member", "viewer", "catalog_editor", "catalog_browser"] as const).includes(
    inviteRole as InviteRole
  )
    ? (inviteRole as InviteRole)
    : "member";

  switch (role) {
    case "viewer":
      return {
        role: "viewer",
        canWrite: false,
        canEditCatalog: false,
        catalogVisibility: "full",
        resourceOwnerIds: ownerIds,
      };
    case "catalog_editor":
      return {
        role: "catalog_editor",
        canWrite: false,
        canEditCatalog: true,
        catalogVisibility: "full",
        resourceOwnerIds: ownerIds,
      };
    case "catalog_browser":
      return {
        role: "catalog_browser",
        canWrite: false,
        canEditCatalog: false,
        catalogVisibility: "public_only",
        resourceOwnerIds: ownerIds,
      };
    default:
      return {
        role: "member",
        canWrite: true,
        canEditCatalog: true,
        catalogVisibility: "full",
        resourceOwnerIds: ownerIds,
      };
  }
}

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
      canEditCatalog: true,
      canManageTeam: false,
      canManageBilling: true,
      resourceOwnerIds: [userId],
      catalogVisibility: "full",
    };
  }

  if (user.ownedOrganization) {
    return {
      role: "owner",
      canWrite: true,
      canEditCatalog: true,
      canManageTeam: true,
      canManageBilling: true,
      resourceOwnerIds: [userId],
      catalogVisibility: "full",
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
    const ownerIds = Array.from(
      new Set(org?.ownerUserId ? [org.ownerUserId, userId] : [userId])
    );
    const base = permissionsFromInviteRole(invite?.role ?? "member", ownerIds);
    return {
      ...base,
      canManageTeam: false,
      canManageBilling: false,
    };
  }

  return {
    role: "solo",
    canWrite: true,
    canEditCatalog: true,
    canManageTeam: false,
    canManageBilling: true,
    resourceOwnerIds: [userId],
    catalogVisibility: "full",
  };
}

/** User id that owns shared workspace resources (connections, pipelines). */
export function workspaceResourceUserId(perms: WorkspacePermissions, userId: string): string {
  if (
    perms.role === "member" ||
    perms.role === "viewer" ||
    perms.role === "catalog_editor" ||
    perms.role === "catalog_browser"
  ) {
    return perms.resourceOwnerIds.find((id) => id !== userId) ?? userId;
  }
  return userId;
}
