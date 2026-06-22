import { NextResponse } from "next/server";
import { getManagedExecutionStatus } from "@/lib/elt/managed-execution-status";
import { resolveControlPlaneBaseUrl } from "@/lib/elt/managed-worker-stub-http";

export async function GET() {
  const status = getManagedExecutionStatus();
  return NextResponse.json({
    ...status,
    controlPlaneUrl: resolveControlPlaneBaseUrl(),
  });
}
