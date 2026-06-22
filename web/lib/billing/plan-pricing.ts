export type BillingInterval = "monthly" | "annual";

/** Pay for 10 months, get 12 — same as ServicePulse annual pricing. */
export const ANNUAL_MONTHS_CHARGED = 10;

export const PLAN_PRICES_USD = {
  pro: { monthly: 29, annual: 29 * ANNUAL_MONTHS_CHARGED },
  team: { monthly: 149, annual: 149 * ANNUAL_MONTHS_CHARGED },
  dedicatedCompute: { monthly: 399, annual: 399 * ANNUAL_MONTHS_CHARGED },
  /**
   * Self-hosted control plane + gateway (Enterprise sales).
   * Floor aligned with mid-market data platforms (~13× Team annual self-serve).
   */
  enterprise: { monthly: 2400, annual: 2400 * ANNUAL_MONTHS_CHARGED },
} as const;

export const ENTERPRISE_PLATFORM_FLOOR_USD = PLAN_PRICES_USD.enterprise;

export function annualPriceFromMonthly(monthlyUsd: number): number {
  return monthlyUsd * ANNUAL_MONTHS_CHARGED;
}

/** Card/list price: monthly rate, or monthly equivalent when billed annually. */
export function displayMonthlyUsd(monthlyUsd: number, interval: BillingInterval): number {
  if (interval === "annual") {
    return Math.round(annualPriceFromMonthly(monthlyUsd) / 12);
  }
  return monthlyUsd;
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export function billingIntervalLabel(interval: BillingInterval): string {
  return interval === "annual" ? "year" : "month";
}

export function resolveWorkspacePlanStripePriceId(
  tier: "pro" | "team",
  interval: BillingInterval
): string | null {
  if (tier === "pro") {
    return interval === "annual"
      ? process.env.STRIPE_PRO_ANNUAL_PRICE_ID?.trim() || null
      : process.env.STRIPE_PRO_MONTHLY_PRICE_ID?.trim() || null;
  }
  return interval === "annual"
    ? process.env.STRIPE_TEAM_ANNUAL_PRICE_ID?.trim() || null
    : process.env.STRIPE_TEAM_MONTHLY_PRICE_ID?.trim() || null;
}

export function resolveDedicatedComputeStripePriceId(interval: BillingInterval): string | null {
  return interval === "annual"
    ? process.env.STRIPE_DEDICATED_COMPUTE_ANNUAL_PRICE_ID?.trim() || null
    : process.env.STRIPE_DEDICATED_COMPUTE_MONTHLY_PRICE_ID?.trim() || null;
}

function envPrice(id: string | undefined): string | null {
  const trimmed = id?.trim();
  return trimmed || null;
}

/** Map a Stripe price id back to workspace tier (Pro/Team). */
export function resolveTierFromStripePriceId(priceId: string): "pro" | "team" | null {
  const id = priceId.trim();
  const proIds = [
    envPrice(process.env.STRIPE_PRO_MONTHLY_PRICE_ID),
    envPrice(process.env.STRIPE_PRO_ANNUAL_PRICE_ID),
  ].filter(Boolean);
  const teamIds = [
    envPrice(process.env.STRIPE_TEAM_MONTHLY_PRICE_ID),
    envPrice(process.env.STRIPE_TEAM_ANNUAL_PRICE_ID),
  ].filter(Boolean);
  if (proIds.includes(id)) return "pro";
  if (teamIds.includes(id)) return "team";
  return null;
}

export function isDedicatedComputeStripePriceId(priceId: string): boolean {
  const id = priceId.trim();
  const dedicatedIds = [
    envPrice(process.env.STRIPE_DEDICATED_COMPUTE_MONTHLY_PRICE_ID),
    envPrice(process.env.STRIPE_DEDICATED_COMPUTE_ANNUAL_PRICE_ID),
  ].filter(Boolean);
  return dedicatedIds.includes(id);
}

export function workspacePlanBillingConfigured(interval: BillingInterval = "monthly"): boolean {
  return Boolean(
    resolveWorkspacePlanStripePriceId("pro", interval) &&
      resolveWorkspacePlanStripePriceId("team", interval)
  );
}

export function dedicatedComputeBillingConfigured(interval: BillingInterval = "monthly"): boolean {
  return Boolean(resolveDedicatedComputeStripePriceId(interval));
}

export function parseBillingInterval(raw: unknown): BillingInterval {
  if (raw === "annual" || raw === "year" || raw === "yearly") return "annual";
  return "monthly";
}
