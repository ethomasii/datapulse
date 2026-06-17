import { getStripe } from "@/lib/billing/stripe";
import { db } from "@/lib/db/client";

/**
 * Report rows synced to Stripe Billing Meter (optional).
 * Configure STRIPE_USAGE_METER_EVENT_NAME in Stripe Dashboard → Billing → Meters.
 */
export async function reportRowsSyncedUsage(userId: string, rows: number): Promise<void> {
  if (!Number.isFinite(rows) || rows <= 0) return;

  const eventName = process.env.STRIPE_USAGE_METER_EVENT_NAME?.trim();
  const stripe = getStripe();
  if (!eventName || !stripe) return;

  const sub = await db.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true, tier: true },
  });
  if (!sub?.stripeCustomerId || sub.tier === "free") return;

  try {
    await stripe.billing.meterEvents.create({
      event_name: eventName,
      payload: {
        value: String(Math.round(rows)),
        stripe_customer_id: sub.stripeCustomerId,
      },
    });
  } catch {
    /* non-fatal — usage reporting must not fail runs */
  }
}

/** Sum rows from succeeded runs in the current calendar month (telemetry JSON). */
export async function getMonthlyRowsSynced(userId: string): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const runs = await db.eltPipelineRun.findMany({
    where: {
      userId,
      status: "succeeded",
      finishedAt: { gte: start },
    },
    select: { telemetry: true },
  });

  let total = 0;
  for (const run of runs) {
    const t = run.telemetry as { summary?: { rowsLoaded?: number } } | null;
    const rows = t?.summary?.rowsLoaded;
    if (typeof rows === "number" && rows > 0) total += rows;
  }
  return total;
}
