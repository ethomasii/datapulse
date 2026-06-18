import { NextResponse } from "next/server";
import type { ApiAuthContext } from "@/lib/auth/api-user";
import { API_SCOPES, hasScope } from "@/lib/auth/api-user";
import {
  getWorkspacePermissions,
  type WorkspacePermissions,
} from "@/lib/auth/org-permissions";

export function hasCatalogReadScope(auth: ApiAuthContext): boolean {
  return (
    hasScope(auth, API_SCOPES.PIPELINES_READ) ||
    hasScope(auth, API_SCOPES.CATALOG_READ)
  );
}

export function hasCatalogWriteScope(auth: ApiAuthContext): boolean {
  return (
    hasScope(auth, API_SCOPES.PIPELINES_WRITE) ||
    hasScope(auth, API_SCOPES.CATALOG_WRITE)
  );
}

export async function loadWorkspacePermissions(userId: string): Promise<WorkspacePermissions> {
  return getWorkspacePermissions(userId);
}

export function viewOnlyResponse(): NextResponse {
  return NextResponse.json({ error: "View-only access" }, { status: 403 });
}

export function catalogEditForbiddenResponse(): NextResponse {
  return NextResponse.json(
    { error: "You do not have permission to edit catalog metadata" },
    { status: 403 }
  );
}

export async function assertCanEditCatalog(userId: string): Promise<NextResponse | null> {
  const perms = await getWorkspacePermissions(userId);
  if (!perms.canEditCatalog) return catalogEditForbiddenResponse();
  return null;
}

export async function assertCanWritePipelines(userId: string): Promise<NextResponse | null> {
  const perms = await getWorkspacePermissions(userId);
  if (!perms.canWrite) return viewOnlyResponse();
  return null;
}
