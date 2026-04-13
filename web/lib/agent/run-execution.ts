import type { ExecutionPlane, PipelineExecutionHost, RunIngestionExecutor } from "@prisma/client";
import { isManagedExecutionPlane } from "@/lib/elt/execution-plane";
import { resolveRunTargetAgentTokenId } from "@/lib/agent/gateway-routing";

export async function resolveNewRunExecution(params: {
  userId: string;
  organizationId: string | null;
  executionHost: PipelineExecutionHost;
  pipelineDefaultTargetAgentTokenId: string | null;
  bodyOverride: string | null | undefined;
  userExecutionPlane: ExecutionPlane;
}): Promise<{ targetAgentTokenId: string | null; ingestionExecutor: RunIngestionExecutor }> {
  const base = {
    userId: params.userId,
    organizationId: params.organizationId,
    bodyOverride: params.bodyOverride,
    pipelineDefaultId: params.pipelineDefaultTargetAgentTokenId,
  };

  if (params.executionHost === "eltpulse_managed") {
    return { targetAgentTokenId: null, ingestionExecutor: "eltpulse_managed" };
  }

  if (params.executionHost === "customer_gateway") {
    const targetAgentTokenId = await resolveRunTargetAgentTokenId(base);
    return {
      targetAgentTokenId,
      ingestionExecutor: targetAgentTokenId ? "customer_agent" : "unspecified",
    };
  }

  // inherit — follow account/org execution plane
  if (isManagedExecutionPlane(params.userExecutionPlane)) {
    return { targetAgentTokenId: null, ingestionExecutor: "eltpulse_managed" };
  }

  const targetAgentTokenId = await resolveRunTargetAgentTokenId(base);
  return {
    targetAgentTokenId,
    ingestionExecutor: targetAgentTokenId ? "customer_agent" : "customer_control_plane",
  };
}
