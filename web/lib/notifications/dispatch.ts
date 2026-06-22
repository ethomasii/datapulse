import { db } from "@/lib/db/client";
import type { NotificationChannel, NotificationPreference, NotificationTrigger } from "@prisma/client";
import { isWithinQuietHours } from "@/lib/notifications/quiet-hours";
import { TRIGGER_LABELS } from "@/lib/notifications/labels";
import {
  sendRunCustomWebhook,
  sendRunDiscord,
  sendRunEmail,
  sendRunAutomationWebhook,
  sendRunGoogleChat,
  sendRunPagerDuty,
  sendRunSlack,
  sendRunTeams,
  type RunNotificationPayload,
} from "@/lib/notifications/channels";

const QUIET_EXEMPT = new Set<NotificationChannel>(["pagerduty"]);

type DispatchInput = {
  userId: string;
  trigger: NotificationTrigger;
  payload: RunNotificationPayload;
};

async function recordSkipped(params: {
  userId: string;
  trigger: NotificationTrigger;
  channel: NotificationChannel;
  payload: RunNotificationPayload;
  skipReason: string;
  details: string;
}) {
  try {
    await db.notificationEvent.create({
      data: {
        userId: params.userId,
        runId: params.payload.runId,
        pipelineId: params.payload.pipelineId,
        contractId: params.payload.contractId ?? null,
        channel: params.channel,
        trigger: params.trigger,
        subject: params.payload.details,
        body: params.details,
        skipReason: params.skipReason,
      },
    });
  } catch {
    /* table may not be migrated */
  }
}

async function recordAndSend(params: {
  userId: string;
  trigger: NotificationTrigger;
  channel: NotificationChannel;
  pref: NotificationPreference;
  payload: RunNotificationPayload;
  send: () => Promise<{ success?: boolean; statusCode?: number; error?: string } | void>;
}) {
  let eventId: string | null = null;
  try {
    const event = await db.notificationEvent.create({
      data: {
        userId: params.userId,
        runId: params.payload.runId,
        pipelineId: params.payload.pipelineId,
        contractId: params.payload.contractId ?? null,
        channel: params.channel,
        trigger: params.trigger,
        subject: `[eltPulse] ${params.payload.pipelineName}: ${TRIGGER_LABELS[params.trigger]}`,
        body: params.payload.details,
        lastAttemptAt: new Date(),
      },
    });
    eventId = event.id;
  } catch {
    /* continue best-effort delivery */
  }

  try {
    const result = await params.send();
    if (eventId) {
      if (result && typeof result === "object" && "success" in result) {
        if (result.success) {
          await db.notificationEvent.update({
            where: { id: eventId },
            data: { sentAt: new Date(), statusCode: result.statusCode ?? null, error: null },
          });
        } else {
          await db.notificationEvent.update({
            where: { id: eventId },
            data: {
              error: result.error?.slice(0, 500) ?? "Delivery failed",
              statusCode: result.statusCode ?? null,
              nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
              retryCount: 1,
            },
          });
        }
      } else {
        await db.notificationEvent.update({
          where: { id: eventId },
          data: { sentAt: new Date(), error: null },
        });
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (eventId) {
      await db.notificationEvent.update({
        where: { id: eventId },
        data: { error: error.slice(0, 500) },
      });
    }
  }
}

function prefMatchesPipeline(pref: NotificationPreference, pipelineId: string | null): boolean {
  if (!pref.pipelineIds.length) return true;
  if (!pipelineId) return true;
  return pref.pipelineIds.includes(pipelineId);
}

export async function dispatchRunNotifications(input: DispatchInput): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    include: { notificationPrefs: true },
  });
  if (!user?.notificationPrefs.length) return;

  for (const pref of user.notificationPrefs) {
    if (!pref.enabled) continue;
    if (!pref.triggers.includes(input.trigger)) continue;
    if (!prefMatchesPipeline(pref, input.payload.pipelineId)) continue;

    if (
      !QUIET_EXEMPT.has(pref.channel) &&
      user.notificationQuietHoursEnabled &&
      user.notificationQuietStart &&
      user.notificationQuietEnd
    ) {
      const tz = user.notificationQuietTimezone?.trim() || user.timezone || "UTC";
      if (
        isWithinQuietHours({
          now: new Date(),
          timeZone: tz,
          quietStart: user.notificationQuietStart,
          quietEnd: user.notificationQuietEnd,
        })
      ) {
        await recordSkipped({
          userId: input.userId,
          trigger: input.trigger,
          channel: pref.channel,
          payload: input.payload,
          skipReason: "quiet_hours",
          details: "Skipped during quiet hours",
        });
        continue;
      }
    }

    const subject = `[eltPulse] ${input.payload.pipelineName}: ${TRIGGER_LABELS[input.trigger]}`;

    switch (pref.channel) {
      case "email":
        if (!pref.emailAddress) continue;
        await recordAndSend({
          userId: input.userId,
          trigger: input.trigger,
          channel: "email",
          pref,
          payload: input.payload,
          send: () => sendRunEmail({ to: pref.emailAddress!, subject, payload: input.payload }),
        });
        break;
      case "slack":
        if (!pref.slackWebhookUrl) continue;
        await recordAndSend({
          userId: input.userId,
          trigger: input.trigger,
          channel: "slack",
          pref,
          payload: input.payload,
          send: () => sendRunSlack({ webhookUrl: pref.slackWebhookUrl!, payload: input.payload }),
        });
        break;
      case "teams":
        if (!pref.teamsWebhookUrl) continue;
        await recordAndSend({
          userId: input.userId,
          trigger: input.trigger,
          channel: "teams",
          pref,
          payload: input.payload,
          send: () => sendRunTeams({ webhookUrl: pref.teamsWebhookUrl!, payload: input.payload }),
        });
        break;
      case "discord":
        if (!pref.discordWebhookUrl) continue;
        await recordAndSend({
          userId: input.userId,
          trigger: input.trigger,
          channel: "discord",
          pref,
          payload: input.payload,
          send: () => sendRunDiscord({ webhookUrl: pref.discordWebhookUrl!, payload: input.payload }),
        });
        break;
      case "pagerduty":
        if (!pref.pagerdutyRoutingKey) continue;
        await recordAndSend({
          userId: input.userId,
          trigger: input.trigger,
          channel: "pagerduty",
          pref,
          payload: input.payload,
          send: () => sendRunPagerDuty({ routingKey: pref.pagerdutyRoutingKey!, payload: input.payload }),
        });
        break;
      case "webhook":
        if (!pref.webhookUrl) continue;
        await recordAndSend({
          userId: input.userId,
          trigger: input.trigger,
          channel: "webhook",
          pref,
          payload: input.payload,
          send: () =>
            sendRunCustomWebhook({
              webhookUrl: pref.webhookUrl!,
              webhookSecret: pref.webhookSecret ?? "",
              webhookPayloadTemplate: pref.webhookPayloadTemplate,
              payload: input.payload,
            }),
        });
        break;
      case "googlechat":
        if (!pref.googlechatWebhookUrl) continue;
        await recordAndSend({
          userId: input.userId,
          trigger: input.trigger,
          channel: "googlechat",
          pref,
          payload: input.payload,
          send: () => sendRunGoogleChat({ webhookUrl: pref.googlechatWebhookUrl!, payload: input.payload }),
        });
        break;
      case "zapier":
        if (!pref.zapierWebhookUrl) continue;
        await recordAndSend({
          userId: input.userId,
          trigger: input.trigger,
          channel: "zapier",
          pref,
          payload: input.payload,
          send: () => sendRunAutomationWebhook({ webhookUrl: pref.zapierWebhookUrl!, payload: input.payload }),
        });
        break;
      case "make":
        if (!pref.makeWebhookUrl) continue;
        await recordAndSend({
          userId: input.userId,
          trigger: input.trigger,
          channel: "make",
          pref,
          payload: input.payload,
          send: () => sendRunAutomationWebhook({ webhookUrl: pref.makeWebhookUrl!, payload: input.payload }),
        });
        break;
      case "n8n":
        if (!pref.n8nWebhookUrl) continue;
        await recordAndSend({
          userId: input.userId,
          trigger: input.trigger,
          channel: "n8n",
          pref,
          payload: input.payload,
          send: () => sendRunAutomationWebhook({ webhookUrl: pref.n8nWebhookUrl!, payload: input.payload }),
        });
        break;
      case "pipedream":
        if (!pref.pipedreamWebhookUrl) continue;
        await recordAndSend({
          userId: input.userId,
          trigger: input.trigger,
          channel: "pipedream",
          pref,
          payload: input.payload,
          send: () => sendRunAutomationWebhook({ webhookUrl: pref.pipedreamWebhookUrl!, payload: input.payload }),
        });
        break;
    }
  }
}

export async function listNotificationEvents(userId: string, limit = 100) {
  try {
    return await db.notificationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        channel: true,
        trigger: true,
        subject: true,
        statusCode: true,
        nextRetryAt: true,
        lastAttemptAt: true,
        retryCount: true,
        responseBody: true,
        skipReason: true,
        sentAt: true,
        error: true,
      },
    });
  } catch {
    return [];
  }
}
