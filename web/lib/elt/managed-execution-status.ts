import {
  managedExecutorCustomerLabel,
  resolveControlPlaneBaseUrl,
  resolveManagedDelegateConfig,
  resolveManagedExecutorMode,
  type ManagedExecutorMode,
} from "@/lib/elt/managed-worker-stub-http";

export type ManagedComputeTier = "active" | "demo" | "unconfigured";

export type ManagedExecutionStatus = {
  mode: ManagedExecutorMode;
  customerLabel: string;
  computeTier: ManagedComputeTier;
  isStub: boolean;
  readyForRealRuns: boolean;
  customerMessage: string;
};

const REAL_EXECUTOR_MODES: ManagedExecutorMode[] = ["delegate", "local", "vercel-python"];

function isRealExecutorMode(mode: ManagedExecutorMode): boolean {
  return REAL_EXECUTOR_MODES.includes(mode);
}

export function getManagedExecutionStatus(): ManagedExecutionStatus {
  const mode = resolveManagedExecutorMode();
  const customerLabel = managedExecutorCustomerLabel(mode);
  const delegate = resolveManagedDelegateConfig();

  const hasInternal = Boolean(process.env.ELTPULSE_INTERNAL_API_SECRET?.trim());
  const hasEncryption = Boolean(process.env.ELTPULSE_TOKEN_ENCRYPTION_KEY?.trim());
  const readyForRealRuns =
    isRealExecutorMode(mode) && hasInternal && hasEncryption && Boolean(delegate);

  let computeTier: ManagedComputeTier = "demo";
  let customerMessage: string;

  if (mode === "stub") {
    computeTier = "demo";
    customerMessage =
      "Demo mode on this environment — runs finish with sample telemetry. eltPulse Cloud production enables real extract/load automatically.";
  } else if (readyForRealRuns) {
    computeTier = "active";
    customerMessage =
      "eltPulse runs your pipelines on managed compute. Connect sources and a warehouse, then hit Run — no gateway required unless you need private network access.";
  } else {
    computeTier = "unconfigured";
    customerMessage =
      "Managed compute is starting on this environment. Saved connection secrets require platform encryption to be enabled.";
  }

  return {
    mode,
    customerLabel,
    computeTier,
    isStub: mode === "stub",
    readyForRealRuns,
    customerMessage,
  };
}
