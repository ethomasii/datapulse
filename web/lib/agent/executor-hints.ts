/**
 * Optional hints on named gateway tokens (`AgentToken.metadata`) for how the reference
 * gateway process should isolate pipeline runs and monitor checks (inline vs spawn).
 */
export type GatewayIsolationMode = "inline" | "spawn";

const MODES = new Set<GatewayIsolationMode>(["inline", "spawn"]);

function readIsolation(meta: Record<string, unknown>, key: string): GatewayIsolationMode {
  const v = meta[key];
  return typeof v === "string" && MODES.has(v as GatewayIsolationMode) ? (v as GatewayIsolationMode) : "inline";
}

/** Reads `pipelineRunIsolation` and `monitorCheckIsolation` from token metadata (defaults: inline). */
export function parseExecutorHintsFromAgentTokenMetadata(metadata: unknown): {
  pipelineRunIsolation: GatewayIsolationMode;
  monitorCheckIsolation: GatewayIsolationMode;
} {
  const m =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return {
    pipelineRunIsolation: readIsolation(m, "pipelineRunIsolation"),
    monitorCheckIsolation: readIsolation(m, "monitorCheckIsolation"),
  };
}
