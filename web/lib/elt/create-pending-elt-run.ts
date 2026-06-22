import type { RunIngestionExecutor } from "@prisma/client";
import { db } from "@/lib/db/client";
import { resolveWorkspaceOrganizationId } from "@/lib/elt/resolve-workspace-org";

export type CreatePendingEltRunInput = {
  userId: string;
  pipelineId?: string | null;
  dbtProjectId?: string | null;
  environment: string;
  triggeredBy: string | null;
  partitionColumn: string | null;
  partitionValue: string | null;
  targetAgentTokenId: string | null;
  ingestionExecutor: RunIngestionExecutor;
  /** When set, must be unique; otherwise a new id is generated. */
  correlationId?: string | null;
  /** Org workspace at enqueue time (for dedicated managed compute routing). */
  workspaceOrganizationId?: string | null;
  sessionOrganizationId?: string | null;
};

export async function createPendingEltRun(input: CreatePendingEltRunInput): Promise<{ id: string }> {
  if (!input.pipelineId && !input.dbtProjectId) {
    throw new Error("pipelineId or dbtProjectId is required");
  }
  const correlationId =
    typeof input.correlationId === "string" && input.correlationId.trim()
      ? input.correlationId.trim()
      : crypto.randomUUID();
  const workspaceOrganizationId =
    input.workspaceOrganizationId !== undefined
      ? input.workspaceOrganizationId
      : await resolveWorkspaceOrganizationId(input.userId, input.sessionOrganizationId);
  const run = await db.eltPipelineRun.create({
    data: {
      userId: input.userId,
      pipelineId: input.pipelineId ?? null,
      dbtProjectId: input.dbtProjectId ?? null,
      workspaceOrganizationId,
      status: "pending",
      environment: input.environment,
      correlationId,
      triggeredBy: input.triggeredBy,
      partitionColumn: input.partitionColumn,
      partitionValue: input.partitionValue,
      targetAgentTokenId: input.targetAgentTokenId,
      ingestionExecutor: input.ingestionExecutor,
    },
    select: { id: true },
  });
  return { id: run.id };
}
