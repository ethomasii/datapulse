import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { appBaseUrl, getStripe } from "@/lib/billing/stripe";
import {
  parseBillingInterval,
  resolveWorkspacePlanStripePriceId,
} from "@/lib/billing/plan-pricing";
import { db } from "@/lib/db/client";

const bodySchema = z.object({
  tier: z.enum(["pro", "team"]).default("pro"),
  interval: z.enum(["monthly", "annual"]).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { tier } = parsed.data;
  const interval = parseBillingInterval(parsed.data.interval);
  const priceId = resolveWorkspacePlanStripePriceId(tier, interval);

  if (!priceId) {
    return NextResponse.json(
      { error: `Price not configured for ${tier} (${interval})` },
      { status: 503 }
    );
  }

  let customerId = user.subscription?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { clerkId: user.clerkId, userId: user.id },
    });
    customerId = customer.id;
    await db.subscription.upsert({
      where: { userId: user.id },
      create: { userId: user.id, stripeCustomerId: customerId, tier: "free", status: "active" },
      update: { stripeCustomerId: customerId },
    });
  }

  const base = appBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.clerkId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/account/billing?checkout=success`,
    cancel_url: `${base}/account/billing?checkout=cancel`,
    metadata: {
      product: "eltpulse",
      tier,
      billing_interval: interval,
    },
    subscription_data: {
      trial_period_days: 14,
      metadata: {
        product: "eltpulse",
        tier,
        billing_interval: interval,
      },
    },
  });

  return NextResponse.json({ url: session.url });
}
