"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { recordWorkspaceAuditEvent } from "@/lib/audit/workspace-audit";
import type { NotificationChannel, NotificationTrigger } from "@prisma/client";
import {
  sendRunAutomationWebhook,
  sendRunCustomWebhook,
  sendRunDiscord,
  sendRunEmail,
  sendRunGoogleChat,
  sendRunPagerDuty,
  sendRunSlack,
  sendRunTeams,
} from "@/lib/notifications/channels";

type ChannelInput = {
  enabled: boolean;
  triggers: NotificationTrigger[];
  emailAddress?: string;
  slackWebhookUrl?: string;
  teamsWebhookUrl?: string;
  discordWebhookUrl?: string;
  pagerdutyRoutingKey?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  webhookPayloadTemplate?: string;
  googlechatWebhookUrl?: string;
  zapierWebhookUrl?: string;
  makeWebhookUrl?: string;
  n8nWebhookUrl?: string;
  pipedreamWebhookUrl?: string;
};

export type SaveNotificationSettingsInput = {
  delivery: {
    quietHoursEnabled: boolean;
    quietStart: string;
    quietEnd: string;
    quietTimezone: string;
  };
  channels: Partial<Record<NotificationChannel, ChannelInput | null>>;
};

export async function saveNotificationSettings(
  input: SaveNotificationSettingsInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireDbUser();

  await db.user.update({
    where: { id: user.id },
    data: {
      notificationQuietHoursEnabled: input.delivery.quietHoursEnabled,
      notificationQuietStart: input.delivery.quietStart.trim() || null,
      notificationQuietEnd: input.delivery.quietEnd.trim() || null,
      notificationQuietTimezone: input.delivery.quietTimezone.trim() || null,
    },
  });

  for (const [channel, cfg] of Object.entries(input.channels)) {
    if (!cfg) continue;
    const ch = channel as NotificationChannel;
    const existing = await db.notificationPreference.findUnique({
      where: { userId_channel: { userId: user.id, channel: ch } },
    });
    const data = {
      enabled: cfg.enabled,
      triggers: cfg.triggers,
      emailAddress: cfg.emailAddress ?? null,
      slackWebhookUrl: cfg.slackWebhookUrl ?? null,
      teamsWebhookUrl: cfg.teamsWebhookUrl ?? null,
      discordWebhookUrl: cfg.discordWebhookUrl ?? null,
      pagerdutyRoutingKey: cfg.pagerdutyRoutingKey ?? null,
      webhookUrl: cfg.webhookUrl ?? null,
      webhookSecret: cfg.webhookSecret ?? null,
      webhookPayloadTemplate: cfg.webhookPayloadTemplate ?? null,
      googlechatWebhookUrl: cfg.googlechatWebhookUrl ?? null,
      zapierWebhookUrl: cfg.zapierWebhookUrl ?? null,
      makeWebhookUrl: cfg.makeWebhookUrl ?? null,
      n8nWebhookUrl: cfg.n8nWebhookUrl ?? null,
      pipedreamWebhookUrl: cfg.pipedreamWebhookUrl ?? null,
    };
    if (existing) {
      await db.notificationPreference.update({ where: { id: existing.id }, data });
    } else {
      await db.notificationPreference.create({
        data: { userId: user.id, channel: ch, pipelineIds: [], ...data },
      });
    }
  }

  await recordWorkspaceAuditEvent({
    userId: user.id,
    actorEmail: user.email,
    action: "notifications.settings_saved",
    detail: { channels: Object.keys(input.channels).filter((k) => input.channels[k as NotificationChannel]) },
  });

  revalidatePath("/account/notifications");
  return { ok: true };
}

export async function sendTestNotification(
  channel: NotificationChannel
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireDbUser();
    const pref = await db.notificationPreference.findUnique({
      where: { userId_channel: { userId: user.id, channel } },
    });
    if (!pref) {
      return { success: false, error: "Save channel settings first." };
    }

    const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://eltpulse.dev").replace(/\/$/, "");
    const payload = {
      trigger: "run_failed" as NotificationTrigger,
      pipelineName: "Test Pipeline",
      pipelineId: null,
      runId: "test-run",
      environment: "dev",
      status: "failed",
      errorSummary: "This is a test notification from eltPulse.",
      runUrl: `${base}/runs`,
      details: "This is a test notification — your channel integration is working.",
      timestamp: new Date().toISOString(),
    };

    switch (channel) {
      case "email":
        if (!pref.emailAddress) return { success: false, error: "Email not configured." };
        await sendRunEmail({
          to: pref.emailAddress,
          subject: "[eltPulse] Test notification",
          payload,
        });
        break;
      case "slack":
        if (!pref.slackWebhookUrl) return { success: false, error: "Slack webhook missing." };
        await sendRunSlack({ webhookUrl: pref.slackWebhookUrl, payload });
        break;
      case "teams":
        if (!pref.teamsWebhookUrl) return { success: false, error: "Teams webhook missing." };
        await sendRunTeams({ webhookUrl: pref.teamsWebhookUrl, payload });
        break;
      case "discord":
        if (!pref.discordWebhookUrl) return { success: false, error: "Discord webhook missing." };
        await sendRunDiscord({ webhookUrl: pref.discordWebhookUrl, payload });
        break;
      case "pagerduty":
        if (!pref.pagerdutyRoutingKey) return { success: false, error: "PagerDuty routing key missing." };
        await sendRunPagerDuty({ routingKey: pref.pagerdutyRoutingKey, payload });
        break;
      case "webhook":
        if (!pref.webhookUrl) return { success: false, error: "Webhook URL missing." };
        await sendRunCustomWebhook({
          webhookUrl: pref.webhookUrl,
          webhookSecret: pref.webhookSecret ?? "",
          webhookPayloadTemplate: pref.webhookPayloadTemplate,
          payload,
        });
        break;
      case "googlechat":
        if (!pref.googlechatWebhookUrl) return { success: false, error: "Google Chat webhook missing." };
        await sendRunGoogleChat({ webhookUrl: pref.googlechatWebhookUrl, payload });
        break;
      case "zapier":
      case "make":
      case "n8n":
      case "pipedream": {
        const url =
          pref.zapierWebhookUrl ?? pref.makeWebhookUrl ?? pref.n8nWebhookUrl ?? pref.pipedreamWebhookUrl;
        if (!url) return { success: false, error: "Automation webhook URL missing." };
        await sendRunAutomationWebhook({ webhookUrl: url, payload });
        break;
      }
      default:
        return { success: false, error: "Unknown channel." };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
