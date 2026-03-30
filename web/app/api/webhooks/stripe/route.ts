import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { db } from "@/lib/db/client";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

/**
 * Stripe → Prisma sync. Expand with price → PlanTier mapping when products go live.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
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

      const userSub = await db.subscription.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (!userSub) break;

      if (event.type === "customer.subscription.deleted") {
        await db.subscription.update({
          where: { id: userSub.id },
          data: {
            stripeSubscriptionId: null,
            status: "canceled",
            tier: "free",
            currentPeriodEnd: null,
          },
        });
        break;
      }

      const priceId = sub.items.data[0]?.price?.id;
      const proPrice = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
      const teamPrice = process.env.STRIPE_TEAM_MONTHLY_PRICE_ID;
      let tier: "free" | "pro" | "team" = "free";
      if (priceId && proPrice && priceId === proPrice) tier = "pro";
      else if (priceId && teamPrice && priceId === teamPrice) tier = "team";

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
      const status = statusMap[sub.status] ?? "active";

      const periodEndUnix =
        sub.items.data[0]?.current_period_end ??
        (sub as unknown as { current_period_end?: number }).current_period_end;

      await db.subscription.update({
        where: { id: userSub.id },
        data: {
          stripeSubscriptionId: sub.id,
          status,
          tier,
          currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
        },
      });
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;
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
