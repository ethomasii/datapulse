import type { PlanTier } from "@prisma/client";
import { getPlan } from "@/lib/plans/config";
import { getEffectiveTier } from "@/lib/plans/plan-enforcement";
import {
  API_KEY_LIMITS,
  PERSONAL_GATEWAY_LIMITS,
  RUN_HISTORY_DAYS,
} from "@/lib/plans/tier-features";
import { PLAN_PIPELINE_LIMITS } from "@/lib/plans/limits";
import type { Subscription } from "@prisma/client";

export type UsageMeterSnapshot = {
  current: number;
  max: number | null;
  percentage: number;
};

function meter(current: number, max: number | null): UsageMeterSnapshot {
  if (max === null) {
    return { current, max: null, percentage: 0 };
  }
  return {
    current,
    max,
    percentage: max === 0 ? 100 : Math.round((current / max) * 100),
  };
}

export type PlanUsageSummary = {
  tier: PlanTier;
  plan: ReturnType<typeof getPlan>;
  pipelines: UsageMeterSnapshot;
  apiKeys: UsageMeterSnapshot;
  personalGateways: UsageMeterSnapshot;
  runHistoryDays: number | null;
  rowsSyncedThisMonth: number;
};

export function getPlanUsageSummary(
  subscription: Subscription | null,
  counts: {
    pipelines: number;
    apiKeys: number;
    personalGateways: number;
    rowsSyncedThisMonth: number;
  }
): PlanUsageSummary {
  const tier = getEffectiveTier(subscription);
  const plan = getPlan(tier);

  return {
    tier,
    plan,
    pipelines: meter(counts.pipelines, PLAN_PIPELINE_LIMITS[tier]),
    apiKeys: meter(counts.apiKeys, API_KEY_LIMITS[tier]),
    personalGateways: meter(counts.personalGateways, PERSONAL_GATEWAY_LIMITS[tier]),
    runHistoryDays: RUN_HISTORY_DAYS[tier],
    rowsSyncedThisMonth: counts.rowsSyncedThisMonth,
  };
}
