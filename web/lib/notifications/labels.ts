import type { NotificationChannel, NotificationTrigger } from "@prisma/client";

export const TRIGGER_LABELS: Record<NotificationTrigger, string> = {
  run_succeeded: "Run succeeded",
  run_failed: "Run failed",
  run_cancelled: "Run cancelled",
  alert_rule_fired: "Observability alert fired",
  pipeline_created: "Pipeline created",
  pipeline_deleted: "Pipeline deleted",
  billing_payment_failed: "Billing payment failed",
  security_new_device: "Security — new device sign-in",
  sla_at_risk: "Data contract SLA at risk",
  sla_breached: "Data contract SLA breached",
  contract_expiring: "Data contract expiring",
  catalog_contract_violated: "Data contract violated",
};

export const TRIGGER_GROUPS: Array<{
  title: string;
  items: Array<{ value: NotificationTrigger; label: string }>;
}> = [
  {
    title: "Pipeline runs",
    items: [
      { value: "run_succeeded", label: TRIGGER_LABELS.run_succeeded },
      { value: "run_failed", label: TRIGGER_LABELS.run_failed },
      { value: "run_cancelled", label: TRIGGER_LABELS.run_cancelled },
    ],
  },
  {
    title: "Observability",
    items: [{ value: "alert_rule_fired", label: TRIGGER_LABELS.alert_rule_fired }],
  },
  {
    title: "Data contracts & SLA",
    items: [
      { value: "sla_at_risk", label: TRIGGER_LABELS.sla_at_risk },
      { value: "sla_breached", label: TRIGGER_LABELS.sla_breached },
      { value: "contract_expiring", label: TRIGGER_LABELS.contract_expiring },
      { value: "catalog_contract_violated", label: TRIGGER_LABELS.catalog_contract_violated },
    ],
  },
  {
    title: "Workspace",
    items: [
      { value: "pipeline_created", label: TRIGGER_LABELS.pipeline_created },
      { value: "pipeline_deleted", label: TRIGGER_LABELS.pipeline_deleted },
    ],
  },
  {
    title: "Billing & security",
    items: [
      { value: "billing_payment_failed", label: TRIGGER_LABELS.billing_payment_failed },
      { value: "security_new_device", label: TRIGGER_LABELS.security_new_device },
    ],
  },
];

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: "Email",
  slack: "Slack",
  teams: "Microsoft Teams",
  discord: "Discord",
  pagerduty: "PagerDuty",
  webhook: "Custom webhook",
  googlechat: "Google Chat",
  zapier: "Zapier",
  make: "Make.com",
  n8n: "n8n",
  pipedream: "Pipedream",
};

export function runStatusToTrigger(status: string): NotificationTrigger | null {
  switch (status) {
    case "succeeded":
      return "run_succeeded";
    case "failed":
      return "run_failed";
    case "cancelled":
      return "run_cancelled";
    default:
      return null;
  }
}

export function describeSkipReason(reason: string): string {
  switch (reason) {
    case "quiet_hours":
      return "Quiet hours";
    case "deduplicated":
      return "Already sent";
    case "pipeline_filter":
      return "Pipeline filter";
    case "plan_gated":
      return "Plan limit";
    default:
      return reason.replace(/_/g, " ");
  }
}