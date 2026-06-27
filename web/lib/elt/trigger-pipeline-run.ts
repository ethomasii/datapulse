import {
  DEFAULT_PIPELINE_RUN_ENVIRONMENT,
  normalizePipelineRunEnvironment,
  type PipelineRunEnvironment,
} from "@/lib/elt/pipeline-run-environment";

export type TriggerPipelineRunInput = {
  pipelineId: string;
  environment?: PipelineRunEnvironment | string;
  partitionValue?: string;
  targetAgentTokenId?: string | null;
  triggeredBy?: string;
};

export type TriggerPipelineRunResult = {
  id: string;
};

/** Queue a pending run (same path as Runs page, webhooks, and slice backfills). */
export async function triggerPipelineRun(
  input: TriggerPipelineRunInput
): Promise<TriggerPipelineRunResult> {
  const body: Record<string, unknown> = {
    pipelineId: input.pipelineId,
    environment: normalizePipelineRunEnvironment(input.environment ?? DEFAULT_PIPELINE_RUN_ENVIRONMENT),
    status: "pending",
  };
  const pv = input.partitionValue?.trim();
  if (pv) {
    body.partitionValue = pv;
  } else {
    body.triggeredBy = input.triggeredBy ?? "manual";
  }
  if (input.targetAgentTokenId !== undefined) {
    body.targetAgentTokenId = input.targetAgentTokenId;
  }

  const res = await fetch("/api/elt/runs", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as { error?: unknown; run?: { id: string } };
  if (!res.ok) {
    const msg =
      typeof data.error === "string"
        ? data.error
        : data.error && typeof data.error === "object"
          ? JSON.stringify(data.error)
          : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  const id = data.run?.id;
  if (!id) throw new Error("Run created but no id returned");
  return { id };
}
