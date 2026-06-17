export async function getAccessibleResourceOwnerIds(userId: string): Promise<string[]> {
  const { getWorkspacePermissions } = await import("@/lib/auth/org-permissions");
  const perms = await getWorkspacePermissions(userId);
  return perms.resourceOwnerIds;
}

export function pipelineOwnerWhere(ownerIds: string[]) {
  return { userId: { in: ownerIds } };
}

export function connectionOwnerWhere(ownerIds: string[]) {
  return { userId: { in: ownerIds } };
}
