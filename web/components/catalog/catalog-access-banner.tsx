"use client";

import Link from "next/link";
import { Eye, Pencil, Shield } from "lucide-react";
import { useWorkspacePermissions } from "@/lib/hooks/use-workspace-permissions";

export function CatalogAccessBanner() {
  const { permissions, loading } = useWorkspacePermissions();
  if (loading || !permissions) return null;

  if (permissions.catalogVisibility === "public_only") {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
        <p className="flex items-center gap-2 font-medium">
          <Eye className="h-4 w-4 shrink-0" />
          Public catalog browse
        </p>
        <p className="mt-1 text-xs text-sky-800 dark:text-sky-200">
          You can browse entries tagged <code className="font-mono">catalog:public</code> or{" "}
          <code className="font-mono">public</code>. Ask a workspace admin for full access.
        </p>
      </div>
    );
  }

  if (!permissions.canEditCatalog && !permissions.canWrite) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <p className="flex items-center gap-2 font-medium">
          <Eye className="h-4 w-4 shrink-0" />
          Read-only catalog
        </p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          You can browse the workspace catalog. Metadata and tags cannot be edited with your current role (
          {permissions.role}).
        </p>
      </div>
    );
  }

  if (permissions.canEditCatalog && !permissions.canWrite) {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
        <p className="flex items-center gap-2 font-medium">
          <Pencil className="h-4 w-4 shrink-0" />
          Catalog editor
        </p>
        <p className="mt-1 text-xs text-violet-800 dark:text-violet-200">
          You can update descriptions and tags. Pipeline and connection changes require a member role.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-4 py-2.5 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Shield className="h-3.5 w-3.5" />
        Authenticated workspace catalog
      </span>
      {" · "}
      Full browse and edit access.
      {!permissions.canManageTeam ? (
        <>
          {" "}
          <Link href="/account/team" className="font-medium underline">
            Team roles
          </Link>{" "}
          control viewer vs editor access.
        </>
      ) : null}
    </div>
  );
}
