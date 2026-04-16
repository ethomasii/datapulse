import type { RunIngestionExecutor } from "@prisma/client";
import { db } from "@/lib/db/client";

export type CreatePendingEltRunInput = {
  userId: string;
  pipelineId: string;
  environment: string;
  triggeredBy: string | null;
  partitionColumn: string | null;
  partitionValue: string | null;
  targetAgentTokenId: string | null;
  ingestionExecutor: RunIngestionExecutor;
  /** When set, must be unique; otherwise a new id is generated. */
  correlationId?: string | null;
};

export async function createPendingEltRun(input: CreatePendingEltRunInput): Promise<{ id: string }> {
  const correlationId =
    typeof input.correlationId === "string" && input.correlationId.trim()
      ? input.correlationId.trim()
      : crypto.randomUUID();
  const run = await db.eltPipelineRun.create({
    data: {
      userId: input.userId,
      pipelineId: input.pipelineId,
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
