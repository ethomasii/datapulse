import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getWorkspacePermissions(user.id);
  return NextResponse.json({
    permissions: {
      role: perms.role,
      canWrite: perms.canWrite,
      canEditCatalog: perms.canEditCatalog,
      canManageTeam: perms.canManageTeam,
      canManageBilling: perms.canManageBilling,
      catalogVisibility: perms.catalogVisibility,
    },
  });
}
