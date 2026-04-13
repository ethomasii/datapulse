import type { PlanTier } from "@prisma/client";

/** Org-scoped named gateway tokens (hybrid org execution) — Pro and Team. */
export function tierAllowsOrgGatewayTokens(tier: PlanTier): boolean {
  return tier === "pro" || tier === "team";
}
