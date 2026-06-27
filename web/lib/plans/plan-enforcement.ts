import type { PlanTier, Subscription } from "@prisma/client";
import type { PlanEnforcementResult } from "@/lib/plans/notification-access";
import {
  canAccessDiscordNotifications,
  canAccessEmailNotifications,
  canAccessPagerDutyNotifications,
  canAccessSlackNotifications,
  canAccessTeamsNotifications,
  canAccessWebhookNotifications,
} from "@/lib/plans/notification-access";
import { tierAllowsAiAssistant, tierAllowsWebhookTriggers, tierAtLeast } from "@/lib/plans/tier-features";

export type { PlanEnforcementResult };

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/** Effective tier — past-due or canceled subscriptions fall back to free. */
export function getEffectiveTier(subscription: Subscription | null): PlanTier {
  if (!subscription) return "free";
  if (!ACTIVE_STATUSES.has(subscription.status)) return "free";
  return subscription.tier;
}

export function canAccessAiAssistant(
  subscription: Subscription | null,
  effectiveTier?: PlanTier
): PlanEnforcementResult {
  const tier = effectiveTier ?? getEffectiveTier(subscription);
  if (!tierAllowsAiAssistant(tier)) {
    return {
      allowed: false,
      reason: "The Pipeline Builder AI requires a Team plan.",
      upgradeRequired: "team",
    };
  }
  return { allowed: true };
}

export function canAccessWebhookTriggers(
  subscription: Subscription | null,
  effectiveTier?: PlanTier
): PlanEnforcementResult {
  const tier = effectiveTier ?? getEffectiveTier(subscription);
  if (!tierAllowsWebhookTriggers(tier)) {
    return {
      allowed: false,
      reason: "Incoming webhook triggers require a Pro or Team plan.",
      upgradeRequired: "pro",
    };
  }
  return { allowed: true };
}

/** True when at least one notification channel is available for alert delivery. */
export function canReceiveAlertNotifications(
  subscription: Subscription | null,
  effectiveTier?: PlanTier
): PlanEnforcementResult {
  const checks = [
    canAccessEmailNotifications(subscription, effectiveTier),
    canAccessTeamsNotifications(subscription, effectiveTier),
    canAccessDiscordNotifications(subscription, effectiveTier),
    canAccessPagerDutyNotifications(subscription, effectiveTier),
    canAccessWebhookNotifications(subscription, effectiveTier),
    canAccessSlackNotifications(subscription, effectiveTier),
  ];
  if (checks.some((c) => c.allowed)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      "Alert rules evaluate on all plans, but delivery requires notification channels (Pro+) or Slack (Team). Configure channels under Account → Notifications.",
    upgradeRequired: "pro",
  };
}

export function tierLabel(tier: PlanTier): string {
  if (tier === "pro") return "Pro";
  if (tier === "team") return "Team";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function meetsMinTier(current: PlanTier, minimum: PlanTier): boolean {
  return tierAtLeast(current, minimum);
}
