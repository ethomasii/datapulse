import {
  resolveControlPlaneBaseUrl,
  resolveManagedExecutorMode,
  type ManagedExecutorMode,
} from "@/lib/elt/managed-worker-stub-http";

export type ManagedExecutionCheck = {
  id: string;
  label: string;
  ok: boolean;
  required: boolean;
  hint?: string;
};

export type ManagedExecutionStatus = {
  mode: ManagedExecutorMode;
  isStub: boolean;
  readyForRealRuns: boolean;
  checks: ManagedExecutionCheck[];
  githubRepo: string | null;
};

export function getManagedExecutionStatus(): ManagedExecutionStatus {
  const mode = resolveManagedExecutorMode();
  const baseUrl = resolveControlPlaneBaseUrl();
  const repo = process.env.ELTPULSE_GITHUB_REPOSITORY?.trim() || null;

  const checks: ManagedExecutionCheck[] = [
    {
      id: "control_plane_url",
      label: "Control plane URL (NEXT_PUBLIC_APP_URL or ELTPULSE_CONTROL_PLANE_URL)",
      ok: Boolean(baseUrl),
      required: true,
      hint: "Set NEXT_PUBLIC_APP_URL=https://eltpulse.dev on Vercel",
    },
    {
      id: "internal_secret",
      label: "ELTPULSE_INTERNAL_API_SECRET",
      ok: Boolean(process.env.ELTPULSE_INTERNAL_API_SECRET?.trim()),
      required: true,
      hint: "Random secret shared with GitHub Actions repo secrets",
    },
    {
      id: "encryption_key",
      label: "ELTPULSE_TOKEN_ENCRYPTION_KEY",
      ok: Boolean(process.env.ELTPULSE_TOKEN_ENCRYPTION_KEY?.trim()),
      required: true,
      hint: "32-byte base64 key for decrypting connection secrets in workers",
    },
    {
      id: "github_dispatch_token",
      label: "ELTPULSE_GITHUB_DISPATCH_TOKEN (Vercel)",
      ok: Boolean(process.env.ELTPULSE_GITHUB_DISPATCH_TOKEN?.trim()),
      required: mode === "gha",
      hint: "Fine-grained PAT with Actions:write on the worker repo",
    },
    {
      id: "github_repository",
      label: "ELTPULSE_GITHUB_REPOSITORY",
      ok: Boolean(repo),
      required: mode === "gha",
      hint: "e.g. ethomasii/datapulse",
    },
    {
      id: "github_actions_secrets",
      label: "GitHub Actions repo secrets (ELTPULSE_CONTROL_PLANE_URL + ELTPULSE_INTERNAL_API_SECRET)",
      ok: mode !== "gha" || Boolean(baseUrl && process.env.ELTPULSE_INTERNAL_API_SECRET?.trim()),
      required: mode === "gha",
      hint: "Settings → Secrets → Actions on the worker repository",
    },
  ];

  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok);
  const readyForRealRuns = mode !== "stub" && requiredOk;

  return {
    mode,
    isStub: mode === "stub",
    readyForRealRuns,
    checks,
    githubRepo: repo,
  };
}
