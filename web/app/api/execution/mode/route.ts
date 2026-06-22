import { NextResponse } from "next/server";
import { getManagedExecutionStatus } from "@/lib/elt/managed-execution-status";

export async function GET() {
  const status = getManagedExecutionStatus();

  return NextResponse.json({
    mode: status.mode,
    label: status.customerLabel,
    computeTier: status.computeTier,
    isStub: status.isStub,
    realCapable: status.readyForRealRuns || status.mode !== "stub",
    readyForRealRuns: status.readyForRealRuns,
    customerMessage: status.customerMessage,
  });
}
