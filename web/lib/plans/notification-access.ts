import type { Subscription } from "@prisma/client";
import type { PlanTier } from "@prisma/client";
import { tierAtLeast } from "@/lib/plans/tier-features";

export type PlanEnforcementResult = {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: PlanTier;
};

function tierForEnforcement(subscription: Subscription | null, effectiveTier?: PlanTier): PlanTier {
  return effectiveTier ?? subscription?.tier ?? "free";
}

export function canAccessEmailNotifications(
  subscription: Subscription | null,
  effectiveTier?: PlanTier
): PlanEnforcementResult {
  const tier = tierForEnforcement(subscription, effectiveTier);
  if (!tierAtLeast(tier, "pro")) {
    return {
      allowed: false,
      reason: "Email notifications require a Pro or Team plan.",
      upgradeRequired: "pro",
    };
  }
  return { allowed: true };
}

export function canAccessSlackNotifications(
  subscription: Subscription | null,
  effectiveTier?: PlanTier
): PlanEnforcementResult {
  const tier = tierForEnforcement(subscription, effectiveTier);
  if (!tierAtLeast(tier, "team")) {
    return {
      allowed: false,
      reason: "Slack notifications require a Team plan.",
      upgradeRequired: "team",
    };
  }
  return { allowed: true };
}

export function canAccessTeamsNotifications(
  subscription: Subscription | null,
  effectiveTier?: PlanTier
): PlanEnforcementResult {
  const tier = tierForEnforcement(subscription, effectiveTier);
  if (!tierAtLeast(tier, "pro")) {
    return {
      allowed: false,
      reason: "Microsoft Teams notifications require a Pro plan.",
      upgradeRequired: "pro",
    };
  }
  return { allowed: true };
}

export function canAccessDiscordNotifications(
  subscription: Subscription | null,
  effectiveTier?: PlanTier
): PlanEnforcementResult {
  const tier = tierForEnforcement(subscription, effectiveTier);
  if (!tierAtLeast(tier, "pro")) {
    return {
      allowed: false,
      reason: "Discord notifications require a Pro plan.",
      upgradeRequired: "pro",
    };
  }
  return { allowed: true };
}

export function canAccessPagerDutyNotifications(
  subscription: Subscription | null,
  effectiveTier?: PlanTier
): PlanEnforcementResult {
  const tier = tierForEnforcement(subscription, effectiveTier);
  if (!tierAtLeast(tier, "pro")) {
    return {
      allowed: false,
      reason: "PagerDuty notifications require a Pro plan.",
      upgradeRequired: "pro",
    };
  }
  return { allowed: true };
}

export function canAccessWebhookNotifications(
  subscription: Subscription | null,
  effectiveTier?: PlanTier
): PlanEnforcementResult {
  const tier = tierForEnforcement(subscription, effectiveTier);
  if (!tierAtLeast(tier, "pro")) {
    return {
      allowed: false,
      reason: "Custom webhook notifications require a Pro plan.",
      upgradeRequired: "pro",
    };
  }
  return { allowed: true };
}
