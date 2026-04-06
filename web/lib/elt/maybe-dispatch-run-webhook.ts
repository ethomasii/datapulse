import { db } from "@/lib/db/client";
import { deliverRunWebhook, type RunWebhookPayload } from "@/lib/elt/run-webhook";

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Fire optional webhook when a run reaches a terminal status (pipeline URL overrides account default). */
export async function maybeDispatchRunWebhook(runId: string, userId: string): Promise<void> {
  const run = await db.eltPipelineRun.findFirst({
    where: { id: runId, userId },
    include: {
      pipeline: { select: { name: true, runsWebhookUrl: true } },
      user: { select: { runsWebhookUrl: true } },
    },
  });

  const webhookUrl = run?.pipeline.runsWebhookUrl ?? run?.user.runsWebhookUrl;
  if (!run || !webhookUrl) return;
  if (!["succeeded", "failed", "cancelled"].includes(run.status)) return;

  const event =
    run.status === "succeeded" ? "run.succeeded" : run.status === "failed" ? "run.failed" : "run.cancelled";

  const base = appBaseUrl();
  const payload: RunWebhookPayload = {
    source: "datapulse",
    event,
    correlationId: run.correlationId,
    pipelineId: run.pipelineId,
    pipelineName: run.pipeline.name,
    environment: run.environment,
    status: run.status,
    errorSummary: run.errorSummary,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    runUrl: `${base}/runs?run=${run.id}`,
  };

  const r = await deliverRunWebhook(webhookUrl, payload);
  await db.eltPipelineRun.update({
    where: { id: run.id },
    data: {
      webhookSentAt: new Date(),
      webhookStatus: r.ok ? "ok" : `http_${r.httpStatus ?? "error"}`,
    },
  });
}
