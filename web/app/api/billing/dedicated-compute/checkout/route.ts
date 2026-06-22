import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { appBaseUrl, getStripe } from "@/lib/billing/stripe";
import {
  dedicatedComputeBillingConfigured,
} from "@/lib/billing/dedicated-compute-pricing";
import { parseBillingInterval, resolveDedicatedComputeStripePriceId } from "@/lib/billing/plan-pricing";
import { getDedicatedComputeBilling } from "@/lib/billing/dedicated-compute-subscription";
import { tierEligibleForDedicatedComputePurchase } from "@/lib/plans/org-dedicated-compute-tier";
import { db } from "@/lib/db/client";

const bodySchema = z.object({
  interval: z.enum(["monthly", "annual"]).optional(),
});

/**
 * POST /api/billing/dedicated-compute/checkout
 * Starts Stripe Checkout for the dedicated managed compute add-on (monthly or annual platform fee + usage).
 */
export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    /* empty body ok */
  }
  const parsed = bodySchema.safeParse(json);
  const interval = parseBillingInterval(parsed.success ? parsed.data.interval : "monthly");
  const org = await db.organization.findUnique({
    where: { ownerUserId: user.id },
    select: { id: true, name: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Create an organization before adding dedicated compute." }, { status: 404 });
  }

  const tier = user.subscription?.tier ?? "free";
  if (!tierEligibleForDedicatedComputePurchase(tier)) {
    return NextResponse.json(
      {
        error: "Dedicated managed compute requires a Team workspace plan first.",
        code: "team_plan_required",
      },
      { status: 403 }
    );
  }

  const existing = await getDedicatedComputeBilling(org.id);
  if (existing?.subscribed) {
    return NextResponse.json(
      { error: "Dedicated managed compute is already active for this organization." },
      { status: 409 }
    );
  }

  const stripe = getStripe();
  const priceId = resolveDedicatedComputeStripePriceId(interval);
  if (!stripe || !priceId || !dedicatedComputeBillingConfigured(interval)) {    return NextResponse.json(
      { error: "Dedicated compute billing is not configured on this environment." },
      { status: 503 }
    );
  }

  let customerId = user.subscription?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { clerkId: user.clerkId, userId: user.id, organizationId: org.id },
    });
    customerId = customer.id;
    await db.subscription.upsert({
      where: { userId: user.id },
      create: { userId: user.id, stripeCustomerId: customerId, tier: "team", status: "active" },
      update: { stripeCustomerId: customerId },
    });
  }

  const base = appBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.clerkId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/team?dedicated_compute=success`,
    cancel_url: `${base}/team?dedicated_compute=cancel`,
    metadata: {
      organizationId: org.id,
      product: "dedicated_compute",
      billing_interval: interval,
    },
    subscription_data: {
      metadata: {
        organizationId: org.id,
        product: "dedicated_compute",
        billing_interval: interval,
      },
    },
  });

  return NextResponse.json({ url: session.url });
}
