import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { getManagedExecutionStatus } from "@/lib/elt/managed-execution-status";
import {
  getOrgManagedComputeStatus,
  managedComputeCustomerLabel,
} from "@/lib/elt/org-managed-compute";
import { resolveControlPlaneBaseUrl } from "@/lib/elt/managed-worker-stub-http";

export async function GET() {
  const status = getManagedExecutionStatus();
  const user = await getCurrentDbUser();

  let orgCompute: {
    mode: string;
    label: string;
    isolatedQueue: boolean;
  } | null = null;

  if (user) {
    const org = await db.organization.findUnique({
      where: { ownerUserId: user.id },
      select: { id: true },
    });
    if (org) {
      const orgStatus = await getOrgManagedComputeStatus(org.id);
      if (orgStatus) {
        orgCompute = {
          mode: orgStatus.mode,
          label: managedComputeCustomerLabel(orgStatus),
          isolatedQueue: orgStatus.isolatedQueue,
        };
      }
    }
  }

  return NextResponse.json({
    ...status,
    orgCompute,
    controlPlaneUrl: resolveControlPlaneBaseUrl(),
  });
}
