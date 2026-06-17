import type { PlanTier } from "@prisma/client";
import { db } from "@/lib/db/client";

export const PLAN_PIPELINE_LIMITS: Record<PlanTier, number | null> = {
  free: 3,
  pro: null,
  team: null,
};

export async function countUserPipelines(userId: string): Promise<number> {
  return db.eltPipeline.count({ where: { userId } });
}

export async function assertCanCreatePipeline(userId: string, tier: PlanTier): Promise<string | null> {
  const limit = PLAN_PIPELINE_LIMITS[tier];
  if (limit === null) return null;
  const count = await countUserPipelines(userId);
  if (count >= limit) {
    return `Free plan allows up to ${limit} pipelines. Upgrade to Pro for unlimited pipelines.`;
  }
  return null;
}
