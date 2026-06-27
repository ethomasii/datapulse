import type { PlanTier } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";

const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  team: 2,
};

/** Target run-history window per tier (enforced on run list APIs). */
export const RUN_HISTORY_DAYS: Record<PlanTier, number | null> = {
  free: 14,
  pro: 90,
  team: 365,
};

export const API_KEY_LIMITS: Record<PlanTier, number | null> = {
  free: 1,
  pro: 5,
  team: null,
};

/** Personal (non-org) gateway connectors per workspace owner. */
export const PERSONAL_GATEWAY_LIMITS: Record<PlanTier, number | null> = {
  free: 1,
  pro: 5,
  team: null,
};

/**
 * Compute model:
 * - All tiers may run a customer gateway (BYOC) — you pay your infra; eltPulse hosts the control plane.
 * - Pro/Team subscription + row usage is how we monetize BYOC (platform fee, not managed-compute margin).
 * - Dedicated managed compute is a separate Team add-on (we run isolated workers).
 * - Enterprise = self-hosted control plane (sales contract via ELTPULSE_ENTERPRISE_ORG_IDS).
 */
export function tierAllowsCustomerGateway(_tier: PlanTier): boolean {
  return true;
}

export function tierAllowsOrgGatewayTokens(tier: PlanTier): boolean {
  return tierAtLeast(tier, "pro");
}

export function personalGatewayLimit(tier: PlanTier): number | null {
  return PERSONAL_GATEWAY_LIMITS[tier];
}

export function tierAtLeast(tier: PlanTier, minimum: PlanTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[minimum];
}

export async function resolveUserPlanTier(userId: string): Promise<PlanTier> {
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { subscription: { select: { tier: true } } },
  });
  return row?.subscription?.tier ?? "free";
}

export function runHistoryCutoff(tier: PlanTier): Date | null {
  const days = RUN_HISTORY_DAYS[tier];
  if (days == null) return null;
  return new Date(Date.now() - days * 86_400_000);
}

/** Prisma filter: runs within tier retention window. */
export function runHistoryPrismaFilter(tier: PlanTier): Prisma.EltPipelineRunWhereInput | undefined {
  const cutoff = runHistoryCutoff(tier);
  if (!cutoff) return undefined;
  return { startedAt: { gte: cutoff } };
}

export function tierAllowsWebhookTriggers(tier: PlanTier): boolean {
  return tierAtLeast(tier, "pro");
}

export function tierAllowsGitArtifactExport(tier: PlanTier): boolean {
  return tierAtLeast(tier, "pro");
}

export function tierAllowsColumnLineage(tier: PlanTier): boolean {
  return tierAtLeast(tier, "pro");
}

export function tierAllowsRunsApi(tier: PlanTier): boolean {
  return tierAtLeast(tier, "pro");
}

/** In-app Pipeline Builder AI and catalog AI — Team+ (same as ServicePulse aiAssistant). */
export function tierAllowsAiAssistant(tier: PlanTier): boolean {
  return tierAtLeast(tier, "team");
}

export function tierAllowsOrgInvites(tier: PlanTier): boolean {
  return tierAtLeast(tier, "team");
}

export function tierAllowsAdvancedWorkspaceRoles(tier: PlanTier): boolean {
  return tierAtLeast(tier, "team");
}

export async function assertApiKeyLimit(userId: string, tier: PlanTier): Promise<string | null> {
  const limit = API_KEY_LIMITS[tier];
  if (limit == null) return null;
  const count = await db.workspaceApiKey.count({
    where: { userId, revokedAt: null },
  });
  if (count >= limit) {
    return limit === 1
      ? "Free plan allows 1 API key. Upgrade to Pro for up to 5."
      : `Your plan allows up to ${limit} API keys. Upgrade to Team for unlimited keys.`;
  }
  return null;
}

export async function assertPersonalGatewayLimit(userId: string, tier: PlanTier): Promise<string | null> {
  const limit = PERSONAL_GATEWAY_LIMITS[tier];
  if (limit == null) return null;
  const count = await db.agentToken.count({
    where: { userId, organizationId: null, revokedAt: null },
  });
  if (count >= limit) {
    return limit === 1
      ? "Free plan allows 1 personal gateway. Upgrade to Pro for up to 5."
      : `Your plan allows up to ${limit} personal gateways. Upgrade to Team for unlimited.`;
  }
  return null;
}

export function upgradeMessageForFeature(feature: string, minimum: PlanTier): string {
  const plan = minimum === "team" ? "Team" : "Pro";
  return `${feature} requires the ${plan} plan. Upgrade from Billing.`;
}
