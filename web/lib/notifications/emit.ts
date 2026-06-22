import type { NotificationTrigger } from "@prisma/client";
import { dispatchRunNotifications } from "@/lib/notifications/dispatch";

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://eltpulse.dev").replace(/\/$/, "");
}

/** Fan-out a workspace event to all enabled notification channels. */
export async function emitWorkspaceNotification(input: {
  userId: string;
  trigger: NotificationTrigger;
  title: string;
  details: string;
  url?: string;
  status?: string;
  environment?: string;
  runId?: string | null;
  pipelineId?: string | null;
  contractId?: string | null;
  errorSummary?: string | null;
}): Promise<void> {
  const base = appBaseUrl();
  try {
    await dispatchRunNotifications({
      userId: input.userId,
      trigger: input.trigger,
      payload: {
        trigger: input.trigger,
        pipelineName: input.title,
        pipelineId: input.pipelineId ?? null,
        runId: input.runId ?? null,
        contractId: input.contractId ?? null,
        environment: input.environment ?? "production",
        status: input.status ?? input.trigger,
        errorSummary: input.errorSummary ?? null,
        runUrl: input.url ?? `${base}/account/notifications`,
        details: input.details,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    /* best-effort */
  }
}

export async function emitBillingPaymentFailed(userId: string, details: string): Promise<void> {
  await emitWorkspaceNotification({
    userId,
    trigger: "billing_payment_failed",
    title: "Billing",
    details,
    url: `${appBaseUrl()}/account/billing`,
    status: "past_due",
  });
}

export async function emitSecurityNewDevice(
  userId: string,
  details: string,
  clientId: string
): Promise<void> {
  await emitWorkspaceNotification({
    userId,
    trigger: "security_new_device",
    title: "Security alert",
    details,
    url: `${appBaseUrl()}/account/security`,
    status: "new_device",
    runId: clientId,
  });
}

export async function emitContractSlaEvent(input: {
  userId: string;
  contractId: string;
  contractName: string;
  trigger: "sla_at_risk" | "sla_breached" | "contract_expiring" | "catalog_contract_violated";
  details: string;
  pipelineId?: string | null;
  runId?: string | null;
}): Promise<void> {
  await emitWorkspaceNotification({
    userId: input.userId,
    trigger: input.trigger,
    title: input.contractName,
    details: input.details,
    contractId: input.contractId,
    pipelineId: input.pipelineId ?? null,
    runId: input.runId ?? null,
    url: `${appBaseUrl()}/catalog/contracts`,
    status: input.trigger,
  });
}
