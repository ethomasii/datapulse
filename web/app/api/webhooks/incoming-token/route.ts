import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import {
  resolveUserPlanTier,
  tierAllowsWebhookTriggers,
  upgradeMessageForFeature,
} from "@/lib/plans/tier-features";

/** Read whether the user has an active incoming webhook token (never returns the full token). */
export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { incomingWebhookToken: true },
  });

  return NextResponse.json({ hasToken: Boolean(row?.incomingWebhookToken) });
}

/** Generate (or rotate) the user's incoming webhook token. Returns the full token ONCE — store it immediately. */
export async function POST() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await resolveUserPlanTier(user.id);
  if (!tierAllowsWebhookTriggers(tier)) {
    return NextResponse.json(
      { error: upgradeMessageForFeature("Incoming webhook triggers", "pro") },
      { status: 403 }
    );
  }

  // 32 bytes → 64 hex chars
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");

  await db.user.update({
    where: { id: user.id },
    data: { incomingWebhookToken: token },
  });

  return NextResponse.json({ token });
}

/** Revoke (clear) the token. */
export async function DELETE() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.user.update({
    where: { id: user.id },
    data: { incomingWebhookToken: null },
  });

  return NextResponse.json({ ok: true });
}
