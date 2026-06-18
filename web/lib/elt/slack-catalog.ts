/**
 * Slack integration for catalog asset discussions (Bot API + optional webhook fallback).
 */

import crypto from "node:crypto";

export type SlackCatalogConfig = {
  botToken: string | undefined;
  channel: string | undefined;
  signingSecret: string | undefined;
  webhookUrl: string | undefined;
  botEnabled: boolean;
  webhookEnabled: boolean;
  twoWayEnabled: boolean;
};

export function slackCatalogConfig(): SlackCatalogConfig {
  const botToken = process.env.SLACK_BOT_TOKEN?.trim();
  const channel = process.env.SLACK_CATALOG_CHANNEL?.trim();
  const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();
  const webhookUrl = process.env.SLACK_CATALOG_WEBHOOK_URL?.trim();
  const botEnabled = Boolean(botToken && channel);
  return {
    botToken,
    channel,
    signingSecret,
    webhookUrl,
    botEnabled,
    webhookEnabled: Boolean(webhookUrl),
    twoWayEnabled: botEnabled && Boolean(signingSecret),
  };
}

export function verifySlackRequestSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  signature: string
): boolean {
  if (!timestamp || !signature.startsWith("v0=")) return false;
  const ageSec = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > 60 * 5) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const digest = `v0=${crypto.createHmac("sha256", signingSecret).update(base).digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function postSlackCatalogMessage(input: {
  text: string;
  threadTs?: string;
}): Promise<{ ok: boolean; channel?: string; ts?: string; error?: string }> {
  const { botToken, channel } = slackCatalogConfig();
  if (!botToken || !channel) return { ok: false, error: "Slack bot not configured" };

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text: input.text,
      ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
      unfurl_links: false,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = (await res.json()) as { ok?: boolean; channel?: string; ts?: string; error?: string };
  return { ok: Boolean(body.ok), channel: body.channel, ts: body.ts, error: body.error };
}

export async function postSlackCatalogWebhook(text: string): Promise<void> {
  const webhook = process.env.SLACK_CATALOG_WEBHOOK_URL?.trim();
  if (!webhook) return;
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => undefined);
}

export async function fetchSlackUserDisplayName(userId: string): Promise<string | null> {
  const { botToken } = slackCatalogConfig();
  if (!botToken || !userId) return null;
  const res = await fetch(`https://slack.com/api/users.info?user=${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${botToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    user?: { real_name?: string; profile?: { display_name?: string } };
  };
  if (!body.ok || !body.user) return null;
  return body.user.profile?.display_name?.trim() || body.user.real_name?.trim() || null;
}
