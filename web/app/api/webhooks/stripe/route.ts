import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { db } from "@/lib/db/client";
import {
  isDedicatedComputeStripePriceId,
  resolveTierFromStripePriceId,
} from "@/lib/billing/plan-pricing";
import {
  clearDedicatedComputeBilling,
  syncDedicatedComputeFromStripeSubscription,
} from "@/lib/billing/dedicated-compute-subscription";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function mapSubscriptionStatus(
  status: Stripe.Subscription.Status
):
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "paused"
  | "incomplete"
  | "incomplete_expired" {
  const statusMap: Record<
    string,
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "paused"
    | "incomplete"
    | "incomplete_expired"
  > = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "past_due",
    paused: "paused",
    incomplete: "incomplete",
    incomplete_expired: "incomplete_expired",
  };
  return statusMap[status] ?? "active";
}

function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const periodEndUnix =
    sub.items.data[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return periodEndUnix ? new Date(periodEndUnix * 1000) : null;
}

function dedicatedOrgIdFromSubscription(sub: Stripe.Subscription): string | null {
  const fromMeta = sub.metadata?.organizationId?.trim();
  if (fromMeta) return fromMeta;
  for (const item of sub.items.data) {
    const id = item.metadata?.organizationId?.trim();
    if (id) return id;
  }
  return null;
}

function isDedicatedComputeSubscription(sub: Stripe.Subscription): boolean {
  if (sub.metadata?.product === "dedicated_compute") return true;
  return sub.items.data.some((item) => {
    const priceId = item.price?.id;
    return Boolean(priceId && isDedicatedComputeStripePriceId(priceId));
  });
}

async function syncWorkspacePlanSubscription(
  sub: Stripe.Subscription,
  customerId: string,
  eventType: string
): Promise<void> {
  const userSub = await db.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });
  if (!userSub) return;

  if (eventType === "customer.subscription.deleted") {
    const dedicatedOnly = isDedicatedComputeSubscription(sub);
    if (dedicatedOnly) return;

    await db.subscription.update({
      where: { id: userSub.id },
      data: {
        stripeSubscriptionId: null,
        status: "canceled",
        tier: "free",
        currentPeriodEnd: null,
      },
    });
    return;
  }

  let tier: "free" | "pro" | "team" | null = null;
  for (const item of sub.items.data) {
    const priceId = item.price?.id;
    if (!priceId) continue;
    const resolved = resolveTierFromStripePriceId(priceId);
    if (resolved) tier = resolved;
  }
  if (tier === null) return;

  await db.subscription.update({
    where: { id: userSub.id },
    data: {
      stripeSubscriptionId: sub.id,
      status: mapSubscriptionStatus(sub.status),
      tier,
      currentPeriodEnd: subscriptionPeriodEnd(sub),
    },
  });
}

async function syncDedicatedComputeSubscription(
  sub: Stripe.Subscription,
  eventType: string
): Promise<void> {
  const organizationId = dedicatedOrgIdFromSubscription(sub);
  if (!organizationId) return;

  if (eventType === "customer.subscription.deleted" || sub.status === "canceled") {
    await clearDedicatedComputeBilling(organizationId);
    return;
  }

  await syncDedicatedComputeFromStripeSubscription(organizationId, sub);
}

/**
 * Stripe → Prisma sync. Workspace plan (Pro/Team) and dedicated compute add-on are separate subscriptions.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;

      if (isDedicatedComputeSubscription(sub)) {
        await syncDedicatedComputeSubscription(sub, event.type);
      } else {
        await syncWorkspacePlanSubscription(sub, customerId, event.type);
      }
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      const clerkId = session.client_reference_id;
      if (customerId && clerkId) {
        const user = await db.user.findUnique({
          where: { clerkId },
          include: { subscription: true },
        });
        if (user?.subscription) {
          await db.subscription.update({
            where: { userId: user.id },
            data: { stripeCustomerId: customerId },
          });
        }
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
