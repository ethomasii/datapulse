import type { PlanTier } from "@prisma/client";

/** Team plan is required before purchasing dedicated managed compute. */
export function tierEligibleForDedicatedComputePurchase(tier: PlanTier): boolean {
  return tier === "team";
}
