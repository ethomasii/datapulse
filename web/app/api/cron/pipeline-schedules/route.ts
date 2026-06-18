import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { dispatchDuePipelineSchedules } from "@/lib/elt/pipeline-schedule-dispatch";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 120;

/**
 * Vercel Cron — evaluates pipeline `cron_schedule` and dbt `dbt.cron_schedule`,
 * enqueues due runs (`schedule:sync` or `schedule:dbt`), then processes managed runs.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (same as other cron routes).
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
    const result = await dispatchDuePipelineSchedules(new Date());
    return NextResponse.json({
      ok: true,
      ...result,
      totalTriggered: result.triggered.length,
    });
  } catch (err) {
    console.error("[cron/pipeline-schedules]", err);
    return NextResponse.json({ error: "Pipeline schedule cron failed" }, { status: 500 });
  }
}
