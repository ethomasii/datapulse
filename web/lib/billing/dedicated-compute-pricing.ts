/** Customer-facing dedicated managed compute pricing (platform fee — usage billed separately). */
import {
  formatUsd,
  PLAN_PRICES_USD,
  resolveDedicatedComputeStripePriceId,
  type BillingInterval,
} from "@/lib/billing/plan-pricing";

export const DEDICATED_COMPUTE_PLATFORM_FEE_USD = PLAN_PRICES_USD.dedicatedCompute.monthly;

export const DEDICATED_COMPUTE_MARKUP_PERCENT = 15;

export function formatDedicatedComputePlatformFee(interval: BillingInterval = "monthly"): string {
  const usd =
    interval === "annual"
      ? PLAN_PRICES_USD.dedicatedCompute.annual
      : PLAN_PRICES_USD.dedicatedCompute.monthly;
  return formatUsd(usd);
}

export function dedicatedComputePricingSummary(interval: BillingInterval = "monthly"): string {
  const unit = interval === "annual" ? "year" : "month";
  return `${formatDedicatedComputePlatformFee(interval)}/${unit} platform fee + metered compute (cost-plus ${DEDICATED_COMPUTE_MARKUP_PERCENT}%)`;
}

/** @deprecated use resolveDedicatedComputeStripePriceId from plan-pricing */
export function dedicatedComputeStripePriceId(interval: BillingInterval = "monthly"): string | null {
  return resolveDedicatedComputeStripePriceId(interval);
}

export function dedicatedComputeBillingConfigured(interval: BillingInterval = "monthly"): boolean {
  return Boolean(resolveDedicatedComputeStripePriceId(interval));
}
