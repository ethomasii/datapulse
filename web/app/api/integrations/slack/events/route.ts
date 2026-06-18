import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import {
  fetchSlackUserDisplayName,
  slackCatalogConfig,
  verifySlackRequestSignature,
} from "@/lib/elt/slack-catalog";

type SlackEventPayload = {
  type?: string;
  challenge?: string;
  event?: {
    type?: string;
    subtype?: string;
    bot_id?: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
  };
};

/** Slack Events API — thread replies sync back into catalog asset discussions. */
export async function POST(req: Request) {
  const cfg = slackCatalogConfig();
  if (!cfg.twoWayEnabled || !cfg.signingSecret) {
    return NextResponse.json({ error: "Slack events not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";
  if (!verifySlackRequestSignature(cfg.signingSecret, timestamp, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(rawBody) as SlackEventPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type === "url_verification" && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== "event_callback" || payload.event?.type !== "message") {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event;
  if (event.bot_id || event.subtype) {
    return NextResponse.json({ ok: true });
  }

  const threadTs = event.thread_ts?.trim();
  const text = event.text?.trim();
  const channel = event.channel?.trim();
  if (!threadTs || !text || !channel || event.ts === threadTs) {
    return NextResponse.json({ ok: true });
  }

  const root = await db.catalogAssetComment.findFirst({
    where: { slackTs: threadTs, slackChannel: channel, parentId: null },
  });
  if (!root) {
    return NextResponse.json({ ok: true });
  }

  const slackUser = event.user?.trim() ?? "unknown";
  const recentDup = await db.catalogAssetComment.findFirst({
    where: {
      parentId: root.id,
      body: text,
      authorEmail: `slack:${slackUser}`,
      createdAt: { gte: new Date(Date.now() - 10_000) },
    },
  });
  if (recentDup) {
    return NextResponse.json({ ok: true });
  }

  const displayName = (await fetchSlackUserDisplayName(slackUser)) ?? `Slack user`;

  await db.catalogAssetComment.create({
    data: {
      userId: root.userId,
      assetKey: root.assetKey,
      body: text,
      authorName: displayName,
      authorEmail: `slack:${slackUser}`,
      parentId: root.id,
    },
  });

  return NextResponse.json({ ok: true });
}
