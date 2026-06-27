import type { PlanTier } from "@prisma/client";
import { PLAN_PRICES_USD } from "@/lib/billing/plan-pricing";

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  description: string;
  monthlyPriceUsd: number | null;
  annualPriceUsd: number | null;
  features: string[];
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: "free",
    name: "Free",
    description: "For individuals getting started",
    monthlyPriceUsd: null,
    annualPriceUsd: null,
    features: [
      "Up to 3 pipelines",
      "Full pipeline builder & connector catalog",
      "Shared managed compute or 1 personal gateway",
      "Visual canvas, schedules & monitors",
      "14-day run history",
      "Community support",
    ],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    description: "For data engineers and small teams",
    monthlyPriceUsd: PLAN_PRICES_USD.pro.monthly,
    annualPriceUsd: PLAN_PRICES_USD.pro.annual,
    features: [
      "Everything in Free",
      "Unlimited pipelines",
      "Included row volume each month (metered beyond)",
      "90-day run history & telemetry",
      "Incoming webhook triggers & Runs API",
      "Git-native artifact export & column lineage",
      "Email, Teams & Discord notifications",
      "5 API keys & 5 personal gateways",
      "Email support",
    ],
  },
  team: {
    tier: "team",
    name: "Team",
    description: "For platform and data orgs",
    monthlyPriceUsd: PLAN_PRICES_USD.team.monthly,
    annualPriceUsd: PLAN_PRICES_USD.team.annual,
    features: [
      "Everything in Pro",
      "Pulse AI — natural-language pipeline builder",
      "Unlimited workspace members & RBAC",
      "Slack notifications",
      "1-year run history",
      "Unlimited API keys & personal gateways",
      "Optional dedicated managed compute add-on",
      "Org-scoped gateway tokens & SSO",
      "Priority support",
    ],
  },
};

export function getPlan(tier: PlanTier): PlanConfig {
  return PLANS[tier];
}
