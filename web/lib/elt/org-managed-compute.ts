import type { ManagedComputeMode } from "@prisma/client";
import { db } from "@/lib/db/client";
import { resolveManagedDelegateConfig } from "@/lib/elt/managed-worker-stub-http";
import { runManagedWorkerDelegateBatchHttp } from "@/lib/elt/managed-worker-delegate";
import {
  dedicatedComputeBillingBypassed,
  isDedicatedComputeBillingActive,
} from "@/lib/billing/dedicated-compute-subscription";

export type DedicatedOrgConfig = {
  organizationId: string;
  name: string;
  batchUrl: string;
  provisioned: boolean;
};

/** Resolve batch URL for a dedicated org (explicit URL, template, or shared co-located + org filter). */
export function resolveDedicatedOrgBatchUrl(explicitUrl: string | null | undefined): string | null {
  const trimmed = explicitUrl?.trim();
  if (trimmed) return trimmed;

  const template = process.env.ELTPULSE_DEDICATED_WORKER_URL_TEMPLATE?.trim();
  if (!template) {
    const shared = resolveManagedDelegateConfig();
    return shared?.url ?? null;
  }
  return null;
}

export function dedicatedWorkerUrlFromTemplate(organizationId: string): string | null {
  const template = process.env.ELTPULSE_DEDICATED_WORKER_URL_TEMPLATE?.trim();
  if (!template) return null;
  return template.replaceAll("{orgId}", organizationId).replaceAll("{organizationId}", organizationId);
}

export async function loadDedicatedOrganizations(): Promise<DedicatedOrgConfig[]> {
  const orgs = await db.organization.findMany({
    where: { managedComputeMode: "dedicated" },
    select: {
      id: true,
      name: true,
      managedWorkerBatchUrl: true,
      dedicatedComputeSubscriptionStatus: true,
    },
  });

  return orgs
    .filter(
      (org) =>
        dedicatedComputeBillingBypassed(org.id) ||
        isDedicatedComputeBillingActive(org.dedicatedComputeSubscriptionStatus)
    )
    .map((org) => {
    const fromTemplate = dedicatedWorkerUrlFromTemplate(org.id);
    const explicit = org.managedWorkerBatchUrl?.trim();
    const batchUrl =
      explicit ?? fromTemplate ?? resolveManagedDelegateConfig()?.url ?? null;
    return {
      organizationId: org.id,
      name: org.name,
      batchUrl: batchUrl ?? "",
      provisioned: Boolean(explicit || fromTemplate),
    };
  });
}

export type ManagedCronDispatchResult = {
  processed: number;
  errors: string[];
  sharedProcessed: number;
  dedicatedProcessed: number;
  dedicatedOrgs: number;
};

/**
 * Cron tick: shared pool excludes dedicated-org runs; each dedicated org gets its own batch dispatch.
 */
export async function dispatchManagedWorkerCron(options: {
  limit: number;
  deadlineMs: number;
  /** Process one run immediately (e.g. right after quick-start enqueue). */
  runId?: string;
}): Promise<ManagedCronDispatchResult> {
  const sharedConfig = resolveManagedDelegateConfig();
  if (!sharedConfig) {
    throw new Error("Managed compute is not configured on this environment.");
  }

  const errors: string[] = [];
  let sharedProcessed = 0;
  let dedicatedProcessed = 0;

  if (options.runId?.trim()) {
    try {
      const result = await runManagedWorkerDelegateBatchHttp({
        batchUrl: sharedConfig.url,
        secret: sharedConfig.secret,
        limit: 1,
        deadlineMs: options.deadlineMs,
        runId: options.runId.trim(),
      });
      sharedProcessed = result.processed;
      errors.push(...result.errors);
    } catch (e) {
      errors.push(`immediate:${e instanceof Error ? e.message : String(e)}`);
    }
    return {
      processed: sharedProcessed,
      errors,
      sharedProcessed,
      dedicatedProcessed: 0,
      dedicatedOrgs: 0,
    };
  }

  const dedicatedOrgs = await loadDedicatedOrganizations();

  for (const org of dedicatedOrgs) {
    if (!org.batchUrl) {
      errors.push(`${org.organizationId}: dedicated mode but no worker URL configured`);
      continue;
    }
    try {
      const result = await runManagedWorkerDelegateBatchHttp({
        batchUrl: org.batchUrl,
        secret: sharedConfig.secret,
        limit: options.limit,
        deadlineMs: options.deadlineMs,
        organizationId: org.organizationId,
      });
      dedicatedProcessed += result.processed;
      errors.push(...result.errors);
    } catch (e) {
      errors.push(`${org.organizationId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  try {
    const shared = await runManagedWorkerDelegateBatchHttp({
      batchUrl: sharedConfig.url,
      secret: sharedConfig.secret,
      limit: options.limit,
      deadlineMs: options.deadlineMs,
      pool: "shared",
    });
    sharedProcessed = shared.processed;
    errors.push(...shared.errors);
  } catch (e) {
    errors.push(`shared: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    processed: sharedProcessed + dedicatedProcessed,
    errors,
    sharedProcessed,
    dedicatedProcessed,
    dedicatedOrgs: dedicatedOrgs.length,
  };
}

export type OrgManagedComputeStatus = {
  mode: ManagedComputeMode;
  batchUrl: string | null;
  provisioned: boolean;
  isolatedQueue: boolean;
};

export async function getOrgManagedComputeStatus(
  organizationId: string
): Promise<OrgManagedComputeStatus | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      managedComputeMode: true,
      managedWorkerBatchUrl: true,
    },
  });
  if (!org) return null;

  const explicit = org.managedWorkerBatchUrl?.trim();
  const fromTemplate = dedicatedWorkerUrlFromTemplate(organizationId);
  const batchUrl = explicit ?? fromTemplate ?? null;

  return {
    mode: org.managedComputeMode,
    batchUrl,
    provisioned: Boolean(explicit || fromTemplate),
    isolatedQueue: org.managedComputeMode === "dedicated",
  };
}

export function managedComputeCustomerLabel(status: OrgManagedComputeStatus): string {
  if (status.mode !== "dedicated") return "Shared managed compute";
  if (status.provisioned) return "Dedicated managed compute";
  return "Dedicated compute (queue isolated — worker provisioning pending)";
}
