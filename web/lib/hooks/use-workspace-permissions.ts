"use client";

import { useEffect, useState } from "react";
import type { CatalogVisibility, WorkspaceRole } from "@/lib/auth/org-permissions";

export type ClientWorkspacePermissions = {
  role: WorkspaceRole;
  canWrite: boolean;
  canEditCatalog: boolean;
  canManageTeam: boolean;
  canManageBilling: boolean;
  catalogVisibility: CatalogVisibility;
};

export function useWorkspacePermissions() {
  const [permissions, setPermissions] = useState<ClientWorkspacePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/elt/workspace/permissions", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { permissions?: ClientWorkspacePermissions } | null) => {
        if (!cancelled && data?.permissions) setPermissions(data.permissions);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { permissions, loading };
}
