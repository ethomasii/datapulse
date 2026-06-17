import { NextResponse } from "next/server";
import { resolveManagedExecutorMode } from "@/lib/elt/managed-worker-stub-http";

export async function GET() {
  const mode = resolveManagedExecutorMode();
  const ghaConfigured = Boolean(
    process.env.ELTPULSE_GITHUB_DISPATCH_TOKEN?.trim() &&
      process.env.ELTPULSE_GITHUB_REPOSITORY?.trim()
  );
  const realCapable = mode !== "stub" || ghaConfigured;

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
    isStub: mode === "stub",
    realCapable,
  });
}
