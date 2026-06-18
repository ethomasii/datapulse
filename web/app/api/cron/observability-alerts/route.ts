import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { evaluateAllObservabilityAlertRules } from "@/lib/elt/evaluate-all-alert-rules";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

/**
 * Vercel Cron — evaluate observability alert rules and fire account webhooks.
 * Schedule in `vercel.json`. Auth: `Authorization: Bearer ${CRON_SECRET}`.
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
    const result = await evaluateAllObservabilityAlertRules({ fireWebhooks: true, cooldownMinutes: 60 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/observability-alerts]", err);
    return NextResponse.json({ error: "Alert cron failed" }, { status: 500 });
  }
}
