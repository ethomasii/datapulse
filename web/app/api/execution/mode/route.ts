import { NextResponse } from "next/server";
import { getManagedExecutionStatus } from "@/lib/elt/managed-execution-status";

export async function GET() {
  const status = getManagedExecutionStatus();
  const mode = status.mode;

  return NextResponse.json({
    mode,
    label:
      mode === "stub"
        ? "Demo (stub)"
        : mode === "gha"
          ? "GitHub Actions"
          : mode === "local"
            ? "Local worker"
            : mode === "vercel-python"
              ? "Vercel Python"
              : mode === "delegate"
                ? "Delegated worker"
                : mode,
    isStub: status.isStub,
    realCapable: status.readyForRealRuns || status.mode !== "stub",
    readyForRealRuns: status.readyForRealRuns,
  });
}
