import type { Subscription } from "@prisma/client";
import type { PlanTier } from "@prisma/client";
import { tierAtLeast } from "@/lib/plans/tier-features";

export type PlanEnforcementResult = {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: PlanTier;
};

function tierFromSubscription(subscription: Subscription | null): PlanTier {
  return subscription?.tier ?? "free";
}

export function canAccessEmailNotifications(subscription: Subscription | null): PlanEnforcementResult {
  const tier = tierFromSubscription(subscription);
  if (!tierAtLeast(tier, "pro")) {
    return {
      allowed: false,
      reason: "Email notifications require a Pro or Team plan.",
      upgradeRequired: "pro",
    };
  }
  return { allowed: true };
}

export function canAccessSlackNotifications(subscription: Subscription | null): PlanEnforcementResult {
  const tier = tierFromSubscription(subscription);
  if (!tierAtLeast(tier, "team")) {
    return {
      allowed: false,
      reason: "Slack notifications require a Team plan.",
      upgradeRequired: "team",
    };
  }
  return { allowed: true };
}

export function canAccessTeamsNotifications(subscription: Subscription | null): PlanEnforcementResult {
  const tier = tierFromSubscription(subscription);
  if (!tierAtLeast(tier, "pro")) {
    return {
      allowed: false,
      reason: "Microsoft Teams notifications require a Pro plan.",
      upgradeRequired: "pro",
    };
  }
  return { allowed: true };
}

export function canAccessDiscordNotifications(subscription: Subscription | null): PlanEnforcementResult {
  const tier = tierFromSubscription(subscription);
  if (!tierAtLeast(tier, "pro")) {
    return {
      allowed: false,
      reason: "Discord notifications require a Pro plan.",
      upgradeRequired: "pro",
    };
  }
  return { allowed: true };
}

export function canAccessPagerDutyNotifications(subscription: Subscription | null): PlanEnforcementResult {
  const tier = tierFromSubscription(subscription);
  if (!tierAtLeast(tier, "pro")) {
    return {
      allowed: false,
      reason: "PagerDuty notifications require a Pro plan.",
      upgradeRequired: "pro",
    };
  }
  return { allowed: true };
}

export function canAccessWebhookNotifications(subscription: Subscription | null): PlanEnforcementResult {
  const tier = tierFromSubscription(subscription);
  if (!tierAtLeast(tier, "pro")) {
    return {
      allowed: false,
      reason: "Custom webhook notifications require a Pro plan.",
      upgradeRequired: "pro",
    };
  }
  return { allowed: true };
}
