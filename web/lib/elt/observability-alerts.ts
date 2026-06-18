import type { PipelineMetricsResponse } from "@/lib/elt/pipeline-metrics";

export type AlertMetric = "success_rate" | "freshness_hours" | "row_drop_pct" | "failed_runs";
export type AlertOperator = "lt" | "gt" | "lte" | "gte";

export type AlertRuleInput = {
  name: string;
  enabled?: boolean;
  metric: AlertMetric;
  operator?: AlertOperator;
  threshold: number;
  windowDays?: number;
  pipelineId?: string | null;
  notifyWebhook?: boolean;
};

export type AlertEvaluation = {
  ruleId: string;
  ruleName: string;
  metric: AlertMetric;
  value: number;
  threshold: number;
  operator: AlertOperator;
  triggered: boolean;
  message: string;
};

function compare(op: AlertOperator, value: number, threshold: number): boolean {
  switch (op) {
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    default:
      return false;
  }
}

function hoursSince(iso: string | null): number {
  if (!iso) return 9999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 9999;
  return (Date.now() - t) / 3_600_000;
}

function pickPipelineRow(metrics: PipelineMetricsResponse, pipelineId: string | null) {
  if (pipelineId) return metrics.byPipeline.find((p) => p.pipelineId === pipelineId);
  return metrics.byPipeline[0];
}

/** Evaluate one rule against aggregated pipeline metrics. */
export function evaluateAlertRule(
  rule: {
    id: string;
    name: string;
    metric: string;
    operator: string;
    threshold: number;
    pipelineId: string | null;
  },
  metrics: PipelineMetricsResponse,
  pipelineName?: string
): AlertEvaluation | null {
  const op = (rule.operator as AlertOperator) ?? "lt";
  const label = pipelineName ?? rule.pipelineId ?? "workspace";

  if (rule.metric === "success_rate") {
    const row = pickPipelineRow(metrics, rule.pipelineId);
    const value = row?.successRate ?? metrics.totals.successRate ?? 100;
    const triggered = compare(op, value, rule.threshold);
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      metric: "success_rate",
      value,
      threshold: rule.threshold,
      operator: op,
      triggered,
      message: triggered
        ? `Success rate ${value.toFixed(1)}% on ${label} breached ${op} ${rule.threshold}%`
        : `Success rate ${value.toFixed(1)}% OK`,
    };
  }

  if (rule.metric === "failed_runs") {
    const row = pickPipelineRow(metrics, rule.pipelineId);
    const value = row?.failed ?? metrics.totals.failed;
    const triggered = compare(op, value, rule.threshold);
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      metric: "failed_runs",
      value,
      threshold: rule.threshold,
      operator: op,
      triggered,
      message: triggered
        ? `${value} failed runs on ${label} (${op} ${rule.threshold})`
        : `${value} failed runs OK`,
    };
  }

  if (rule.metric === "freshness_hours") {
    const row = pickPipelineRow(metrics, rule.pipelineId);
    const hours =
      row?.lastRunStatus === "succeeded" ? hoursSince(row.lastRunAt) : hoursSince(row?.lastRunAt ?? null);
    const triggered = compare(op, hours, rule.threshold);
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      metric: "freshness_hours",
      value: hours,
      threshold: rule.threshold,
      operator: op,
      triggered,
      message: triggered
        ? `Last success ${hours.toFixed(0)}h ago on ${label} (${op} ${rule.threshold}h)`
        : `Freshness ${hours.toFixed(0)}h OK`,
    };
  }

  if (rule.metric === "row_drop_pct") {
    // Approximate row-drop as failed-run ratio when explicit volume deltas are unavailable.
    const row = pickPipelineRow(metrics, rule.pipelineId);
    const runs = row?.runs ?? metrics.totals.runs;
    const failed = row?.failed ?? metrics.totals.failed;
    const value = runs > 0 ? (failed / runs) * 100 : 0;
    const triggered = compare(op, value, rule.threshold);
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      metric: "row_drop_pct",
      value,
      threshold: rule.threshold,
      operator: op,
      triggered,
      message: triggered
        ? `Failure ratio ${value.toFixed(1)}% on ${label} (${op} ${rule.threshold}%)`
        : `Run failure ratio OK`,
    };
  }

  return null;
}
