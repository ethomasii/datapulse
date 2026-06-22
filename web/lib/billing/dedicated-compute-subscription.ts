import type { SubscriptionStatus } from "@prisma/client";
import type Stripe from "stripe";
import { db } from "@/lib/db/client";

const ACTIVE_STATUSES: SubscriptionStatus[] = ["active", "trialing"];

export type DedicatedComputeBilling = {
  subscribed: boolean;
  status: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  stripeSubscriptionId: string | null;
};

export function isDedicatedComputeBillingActive(
  status: SubscriptionStatus | null | undefined
): boolean {
  return Boolean(status && ACTIVE_STATUSES.includes(status));
}

export async function getDedicatedComputeBilling(
  organizationId: string
): Promise<DedicatedComputeBilling | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      dedicatedComputeStripeSubscriptionId: true,
      dedicatedComputeSubscriptionStatus: true,
      dedicatedComputeCurrentPeriodEnd: true,
    },
  });
  if (!org) return null;
  const status = org.dedicatedComputeSubscriptionStatus;
  return {
    subscribed: isDedicatedComputeBillingActive(status),
    status,
    currentPeriodEnd: org.dedicatedComputeCurrentPeriodEnd,
    stripeSubscriptionId: org.dedicatedComputeStripeSubscriptionId,
  };
}

function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status
): SubscriptionStatus {
  const statusMap: Record<string, SubscriptionStatus> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "past_due",
    paused: "paused",
    incomplete: "incomplete",
    incomplete_expired: "incomplete_expired",
  };
  return statusMap[status] ?? "active";
}

function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const periodEndUnix =
    sub.items.data[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return periodEndUnix ? new Date(periodEndUnix * 1000) : null;
}

/** Sync org billing + compute mode from a Stripe dedicated-compute subscription. */
export async function syncDedicatedComputeFromStripeSubscription(
  organizationId: string,
  sub: Stripe.Subscription
): Promise<void> {
  const status = mapStripeSubscriptionStatus(sub.status);
  const active = isDedicatedComputeBillingActive(status);

  await db.organization.update({
    where: { id: organizationId },
    data: {
      dedicatedComputeStripeSubscriptionId: sub.id,
      dedicatedComputeSubscriptionStatus: status,
      dedicatedComputeCurrentPeriodEnd: subscriptionPeriodEnd(sub),
      managedComputeMode: active ? "dedicated" : "shared",
    },
  });
}

/** Clear dedicated billing and revert org to shared managed compute. */
export async function clearDedicatedComputeBilling(organizationId: string): Promise<void> {
  await db.organization.update({
    where: { id: organizationId },
    data: {
      dedicatedComputeStripeSubscriptionId: null,
      dedicatedComputeSubscriptionStatus: null,
      dedicatedComputeCurrentPeriodEnd: null,
      managedComputeMode: "shared",
    },
  });
}

/** Ops-only bypass for staging / enterprise manual provisioning. */
export function dedicatedComputeBillingBypassed(organizationId: string): boolean {
  const raw = process.env.ELTPULSE_DEDICATED_COMPUTE_BILLING_BYPASS_ORG_IDS?.trim();
  if (!raw) return false;
  return raw.split(",").map((s) => s.trim()).filter(Boolean).includes(organizationId);
}

export async function orgCanUseDedicatedManagedCompute(organizationId: string): Promise<boolean> {
  if (dedicatedComputeBillingBypassed(organizationId)) return true;
  const billing = await getDedicatedComputeBilling(organizationId);
  return Boolean(billing?.subscribed);
}
