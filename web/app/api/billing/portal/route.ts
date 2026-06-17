import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { appBaseUrl, getStripe } from "@/lib/billing/stripe";
import { db } from "@/lib/db/client";

export async function POST() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const customerId = user.subscription?.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account yet. Upgrade to Pro or Team first." },
      { status: 400 }
    );
  }

  const base = appBaseUrl();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/account/billing`,
  });

  return NextResponse.json({ url: session.url });
}
