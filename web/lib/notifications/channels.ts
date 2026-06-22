import { createHmac } from "crypto";
import type { NotificationTrigger } from "@prisma/client";
import { getResend, defaultFrom } from "@/lib/email/resend";
import { TRIGGER_LABELS } from "@/lib/notifications/labels";

export type RunNotificationPayload = {
  trigger: NotificationTrigger;
  pipelineName: string;
  pipelineId: string | null;
  runId: string;
  environment: string;
  status: string;
  errorSummary: string | null;
  runUrl: string;
  details: string;
  timestamp: string;
};

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL ?? "https://eltpulse.dev").replace(/\/$/, "");

export async function sendRunEmail(params: {
  to: string;
  subject: string;
  payload: RunNotificationPayload;
}): Promise<void> {
  const mailer = getResend();
  if (!mailer) {
    console.warn("[notifications] RESEND_API_KEY not set — skipping email");
    return;
  }
  const from = defaultFrom();
  const triggerLabel = TRIGGER_LABELS[params.payload.trigger] ?? params.payload.trigger;
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
<div style="background:#0f172a;padding:20px 24px"><h1 style="color:#fff;margin:0;font-size:18px">eltPulse</h1></div>
<div style="padding:24px">
<p style="font-size:20px;font-weight:700;margin:0 0 8px">${params.payload.pipelineName}</p>
<p style="display:inline-block;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;background:#fef3c7;color:#92400e">${triggerLabel}</p>
<p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #2563eb;border-radius:4px;color:#374151">${params.payload.details}</p>
<a href="${params.payload.runUrl}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">View run →</a>
</div>
<div style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af">
<a href="${APP_URL()}/account/notifications" style="color:#6b7280">Manage notifications</a>
</div></div></body></html>`;
  await mailer.emails.send({
    from: `${from.name} <${from.email}>`,
    to: params.to,
    subject: params.subject,
    html,
  });
}

export async function sendRunSlack(params: {
  webhookUrl: string;
  payload: RunNotificationPayload;
}): Promise<void> {
  const color =
    params.payload.trigger === "run_succeeded"
      ? "#00C853"
      : params.payload.trigger === "run_failed"
        ? "#FF0000"
        : "#888888";
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: params.payload.pipelineName, emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${TRIGGER_LABELS[params.payload.trigger]}*\n${params.payload.details}` },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `Environment: \`${params.payload.environment}\`` }],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View run" },
          url: params.payload.runUrl,
        },
      ],
    },
  ];
  const res = await fetch(params.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attachments: [{ color, blocks }] }),
  });
  if (!res.ok) throw new Error(`Slack webhook failed: ${res.status}`);
}

export async function sendRunTeams(params: {
  webhookUrl: string;
  payload: RunNotificationPayload;
}): Promise<void> {
  const themeColor =
    params.payload.trigger === "run_succeeded"
      ? "00C853"
      : params.payload.trigger === "run_failed"
        ? "FF0000"
        : "888888";
  const body = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor,
    summary: params.payload.details,
    sections: [
      {
        activityTitle: `**${params.payload.pipelineName}**`,
        activitySubtitle: TRIGGER_LABELS[params.payload.trigger],
        activityText: params.payload.details,
        facts: [
          { name: "Environment", value: params.payload.environment },
          { name: "Status", value: params.payload.status },
        ],
      },
    ],
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "View run",
        targets: [{ os: "default", uri: params.payload.runUrl }],
      },
    ],
  };
  const res = await fetch(params.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Teams webhook failed: ${res.status}`);
}

export async function sendRunDiscord(params: {
  webhookUrl: string;
  payload: RunNotificationPayload;
}): Promise<void> {
  const color =
    params.payload.trigger === "run_succeeded" ? 3329330 : params.payload.trigger === "run_failed" ? 16711680 : 3447003;
  const embed = {
    title: `${params.payload.pipelineName} — ${TRIGGER_LABELS[params.payload.trigger]}`,
    description: params.payload.details,
    color,
    fields: [
      { name: "Environment", value: params.payload.environment, inline: true },
      { name: "Status", value: params.payload.status, inline: true },
    ],
    url: params.payload.runUrl,
    footer: { text: "eltPulse" },
    timestamp: params.payload.timestamp,
  };
  const res = await fetch(params.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "eltPulse", embeds: [embed] }),
  });
  if (!res.ok) throw new Error(`Discord webhook failed: ${res.status}`);
}

export async function sendRunPagerDuty(params: {
  routingKey: string;
  payload: RunNotificationPayload;
}): Promise<void> {
  const isResolve = params.payload.trigger === "run_succeeded";
  const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      routing_key: params.routingKey,
      event_action: isResolve ? "resolve" : "trigger",
      dedup_key: `eltpulse-run-${params.payload.runId}`,
      payload: {
        summary: params.payload.details,
        severity: params.payload.trigger === "run_failed" ? "error" : "info",
        source: "eltPulse",
        component: params.payload.pipelineName,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PagerDuty failed: ${res.status}${text ? ` — ${text}` : ""}`);
  }
}

export async function sendRunGoogleChat(params: {
  webhookUrl: string;
  payload: RunNotificationPayload;
}): Promise<void> {
  const body = {
    cards: [
      {
        header: { title: params.payload.pipelineName, subtitle: TRIGGER_LABELS[params.payload.trigger] },
        sections: [
          {
            widgets: [
              { textParagraph: { text: params.payload.details } },
              {
                buttons: [
                  {
                    textButton: {
                      text: "View run",
                      onClick: { openLink: { url: params.payload.runUrl } },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const res = await fetch(params.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google Chat webhook failed: ${res.status}`);
}

export async function sendRunAutomationWebhook(params: {
  webhookUrl: string;
  payload: RunNotificationPayload;
}): Promise<void> {
  const res = await fetch(params.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "eltpulse",
      trigger: params.payload.trigger,
      pipeline: {
        id: params.payload.pipelineId,
        name: params.payload.pipelineName,
        environment: params.payload.environment,
      },
      run: {
        id: params.payload.runId,
        status: params.payload.status,
        url: params.payload.runUrl,
        errorSummary: params.payload.errorSummary,
      },
      details: params.payload.details,
      timestamp: params.payload.timestamp,
    }),
  });
  if (!res.ok) throw new Error(`Webhook failed: ${res.status}`);
}

export async function sendRunCustomWebhook(params: {
  webhookUrl: string;
  webhookSecret: string;
  webhookPayloadTemplate: string | null;
  payload: RunNotificationPayload;
}): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const defaultPayload = {
    source: "eltpulse",
    trigger: params.payload.trigger,
    pipeline: {
      id: params.payload.pipelineId ?? "",
      name: params.payload.pipelineName,
      environment: params.payload.environment,
    },
    run: {
      id: params.payload.runId,
      status: params.payload.status,
      errorSummary: params.payload.errorSummary ?? "",
      url: params.payload.runUrl,
    },
    details: params.payload.details,
    timestamp: params.payload.timestamp,
  };

  let bodyStr: string;
  if (params.webhookPayloadTemplate?.trim()) {
    bodyStr = params.webhookPayloadTemplate
      .replace(/\{\{\s*pipeline\.name\s*\}\}/gi, params.payload.pipelineName)
      .replace(/\{\{\s*run\.status\s*\}\}/gi, params.payload.status)
      .replace(/\{\{\s*trigger\s*\}\}/gi, params.payload.trigger)
      .replace(/\{\{\s*details\s*\}\}/gi, params.payload.details)
      .replace(/\{\{\s*timestamp\s*\}\}/gi, params.payload.timestamp);
  } else {
    bodyStr = JSON.stringify(defaultPayload, null, 2);
  }

  const signature = createHmac("sha256", params.webhookSecret || "")
    .update(bodyStr)
    .digest("hex");

  try {
    const res = await fetch(params.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature,
        "X-Timestamp": params.payload.timestamp,
      },
      body: bodyStr,
      signal: AbortSignal.timeout(10_000),
    });
    const statusCode = res.status;
    if (statusCode >= 200 && statusCode < 300) {
      return { success: true, statusCode };
    }
    const text = await res.text().catch(() => "");
    return { success: false, statusCode, error: `HTTP ${statusCode}: ${text.slice(0, 200)}` };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
