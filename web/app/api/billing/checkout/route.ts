import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { appBaseUrl, getStripe } from "@/lib/billing/stripe";
import { db } from "@/lib/db/client";

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  let tier: "pro" | "team" = "pro";
  try {
    const body = (await req.json()) as { tier?: string };
    if (body.tier === "team") tier = "team";
  } catch {
    /* default pro */
  }

  const priceId =
    tier === "team"
      ? process.env.STRIPE_TEAM_MONTHLY_PRICE_ID
      : process.env.STRIPE_PRO_MONTHLY_PRICE_ID;

  if (!priceId) {
    return NextResponse.json({ error: "Price not configured for this tier" }, { status: 503 });
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
    subscription_data: {
      trial_period_days: 14,
    },
  });

  return NextResponse.json({ url: session.url });
}
