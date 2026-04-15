const UA = "eltPulse-Runs/1";

export type RunWebhookPayload = {
  /** Lets multi-product receivers (e.g. ServicePulse) identify the emitter. */
  source?: "eltpulse";
  event: "run.succeeded" | "run.failed" | "run.cancelled";
  correlationId: string;
  pipelineId: string;
  pipelineName: string;
  environment: string;
  status: string;
  errorSummary: string | null;
  startedAt: string;
  finishedAt: string | null;
  /** Deep link in eltPulse (no secrets). */
  runUrl: string;
  /** Final rollup if the runner reported metrics (rows/bytes/progress). */
  telemetrySummary?: Record<string, unknown>;
};

export async function deliverRunWebhook(url: string, payload: RunWebhookPayload): Promise<{ ok: boolean; httpStatus?: number }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": UA,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    return { ok: res.ok, httpStatus: res.status };
  } catch {
    return { ok: false };
  }
}
