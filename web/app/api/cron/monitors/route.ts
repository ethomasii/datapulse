import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { resolveCronMonitorScale } from "@/lib/monitors/cron-scale";
import { runMonitorChecksForAllUsers } from "@/lib/monitors/run-monitors";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
/** Vercel Pro: allow enough time for many S3 listings. */
export const maxDuration = 120;

/**
 * Vercel Cron — schedule in `vercel.json`. Evaluates all eltPulse monitors (S3/SQS in Node)
 * and enqueues pipeline runs when conditions match.
 *
 * Same auth pattern as ServicePulse: `Authorization: Bearer ${CRON_SECRET}` (set in Vercel env).
 *
 * Optional scaling (see `docs/control-plane-scaling.md`):
 * - Query `?shard=0&shards=4` (or env `CRON_MONITOR_SHARD_*`) to evaluate disjoint monitor subsets in parallel crons.
 * - Query `budgetMs=90000` or env `CRON_MONITOR_MAX_MS` to stop early and continue on the next tick.
 */
export async function GET(request: Request) {
  noStore();
  const authHeader = request.headers.get("authorization");

  if (process.env.NODE_ENV !== "production") {
    const secret = process.env.CRON_SECRET;
    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const scale = resolveCronMonitorScale(request.url, process.env);
    const result = await runMonitorChecksForAllUsers(scale);
    return NextResponse.json({
      ok: true,
      ...result,
      totalTriggered: result.triggeredSensors.length,
    });
  } catch (err) {
    console.error("[cron/monitors]", err);
    return NextResponse.json({ error: "Monitor cron failed" }, { status: 500 });
  }
}
