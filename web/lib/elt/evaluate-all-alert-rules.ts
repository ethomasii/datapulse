/**
 * Evaluate all enabled observability alert rules and optionally fire webhooks.
 */

import { db } from "@/lib/db/client";
import { fetchPipelineMetricsForUser } from "@/lib/elt/pipeline-metrics";
import { evaluateAlertRule } from "@/lib/elt/observability-alerts";
import { deliverRunWebhook } from "@/lib/elt/run-webhook";
import { dispatchRunNotifications } from "@/lib/notifications/dispatch";

export type AlertCronResult = {
  evaluated: number;
  triggered: number;
  fired: number;
  errors: string[];
  details: Array<{ ruleId: string; ruleName: string; userId: string; message: string; fired: boolean }>;
};

export async function evaluateAllObservabilityAlertRules(options?: {
  fireWebhooks?: boolean;
  /** Skip re-firing within this many minutes of last trigger */
  cooldownMinutes?: number;
}): Promise<AlertCronResult> {
  const fireWebhooks = options?.fireWebhooks ?? true;
  const cooldownMs = (options?.cooldownMinutes ?? 60) * 60_000;
  const now = Date.now();

  const rules = await db.observabilityAlertRule.findMany({
    where: { enabled: true },
    include: { user: { select: { runsWebhookUrl: true } } },
  });

  const result: AlertCronResult = {
    evaluated: 0,
    triggered: 0,
    fired: 0,
    errors: [],
    details: [],
  };

  for (const rule of rules) {
    result.evaluated += 1;
    try {
      const metrics = await fetchPipelineMetricsForUser(rule.userId, {
        days: rule.windowDays,
        pipelineId: rule.pipelineId ?? undefined,
      });
      const pipelineName = rule.pipelineId
        ? metrics.byPipeline.find((p) => p.pipelineId === rule.pipelineId)?.pipelineName
        : undefined;
      const evaluation = evaluateAlertRule(rule, metrics, pipelineName);
      if (!evaluation?.triggered) continue;

      result.triggered += 1;

      const last = rule.lastTriggeredAt?.getTime() ?? 0;
      if (now - last < cooldownMs) {
        result.details.push({
          ruleId: rule.id,
          ruleName: rule.name,
          userId: rule.userId,
          message: `${evaluation.message} (cooldown)`,
          fired: false,
        });
        continue;
      }

      let fired = false;
      const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://eltpulse.dev").replace(/\/$/, "");
      try {
        await dispatchRunNotifications({
          userId: rule.userId,
          trigger: "alert_rule_fired",
          payload: {
            trigger: "alert_rule_fired",
            pipelineName: pipelineName ?? rule.name,
            pipelineId: rule.pipelineId,
            runId: `alert-${rule.id}`,
            environment: "production",
            status: "alert",
            errorSummary: evaluation.message,
            runUrl: `${base}/observability`,
            details: evaluation.message,
            timestamp: new Date().toISOString(),
          },
        });
        fired = true;
      } catch {
        /* multi-channel notify is best-effort */
      }

      if (fireWebhooks && rule.notifyWebhook && rule.user.runsWebhookUrl) {
        const r = await deliverRunWebhook(rule.user.runsWebhookUrl, {
          source: "eltpulse",
          event: "run.failed",
          correlationId: `alert-${rule.id}-${Date.now()}`,
          pipelineId: rule.pipelineId,
          pipelineName: pipelineName ?? rule.name,
          environment: "production",
          status: "alert",
          errorSummary: evaluation.message,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          runUrl: "/observability",
        });
        fired = r.ok || fired;
        if (fired) {
          await db.observabilityAlertRule.update({
            where: { id: rule.id },
            data: { lastTriggeredAt: new Date() },
          });
          result.fired += 1;
        }
      }

      result.details.push({
        ruleId: rule.id,
        ruleName: rule.name,
        userId: rule.userId,
        message: evaluation.message,
        fired,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`${rule.name}: ${msg}`);
    }
  }

  return result;
}
