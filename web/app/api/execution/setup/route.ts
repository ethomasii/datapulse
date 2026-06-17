import { NextResponse } from "next/server";
import { getManagedExecutionStatus } from "@/lib/elt/managed-execution-status";
import { resolveControlPlaneBaseUrl } from "@/lib/elt/managed-worker-stub-http";

export async function GET() {
  const status = getManagedExecutionStatus();
  const baseUrl = resolveControlPlaneBaseUrl();

  return NextResponse.json({
    ...status,
    controlPlaneUrl: baseUrl,
    setup: {
      vercel: [
        { key: "ELTPULSE_MANAGED_EXECUTOR", value: "gha", note: "Or omit when dispatch token + repo are set" },
        { key: "ELTPULSE_GITHUB_DISPATCH_TOKEN", value: "(PAT with Actions:write)" },
        { key: "ELTPULSE_GITHUB_REPOSITORY", value: status.githubRepo ?? "owner/repo" },
        { key: "ELTPULSE_INTERNAL_API_SECRET", value: "(shared secret)" },
        { key: "ELTPULSE_TOKEN_ENCRYPTION_KEY", value: "(32-byte base64)" },
        { key: "NEXT_PUBLIC_APP_URL", value: baseUrl ?? "https://eltpulse.dev" },
      ],
      githubActions: [
        { key: "ELTPULSE_CONTROL_PLANE_URL", value: baseUrl ?? "https://eltpulse.dev" },
        { key: "ELTPULSE_INTERNAL_API_SECRET", value: "(same as Vercel)" },
      ],
    },
  });
}
