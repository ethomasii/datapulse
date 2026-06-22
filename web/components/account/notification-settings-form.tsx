"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, ChevronDown, ChevronRight, Loader2, Lock, Send, Webhook } from "lucide-react";
import type { NotificationChannel, NotificationPreference, NotificationTrigger } from "@prisma/client";
import { saveNotificationSettings, sendTestNotification } from "@/app/(app)/account/notifications/actions";
import { CHANNEL_LABELS, TRIGGER_GROUPS } from "@/lib/notifications/labels";

type ChannelDef = {
  id: NotificationChannel;
  color: string;
  icon: string;
  can: boolean;
  upgradeReason?: string;
  subtitle: string;
  configFields: "email" | "slack" | "teams" | "discord" | "pagerduty" | "webhook" | "googlechat" | "automation";
};

function ToggleSwitch({
  enabled,
  onToggle,
  disabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        enabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
          enabled ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function TriggerCheckboxes({
  triggers,
  selected,
  onChange,
  disabled,
}: {
  triggers: NotificationTrigger[];
  selected: NotificationTrigger[];
  onChange: (v: NotificationTrigger[]) => void;
  disabled?: boolean;
}) {
  function toggle(t: NotificationTrigger) {
    onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t]);
  }
  return (
    <div className="space-y-4">
      {TRIGGER_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.title}</p>
          <div className="space-y-2">
            {group.items.map((item) => (
              <label key={item.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={selected.includes(item.value)}
                  onChange={() => toggle(item.value)}
                  disabled={disabled}
                  className="rounded border-slate-300"
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type Props = {
  userEmail: string;
  prefs: Partial<Record<NotificationChannel, NotificationPreference | null>>;
  access: Partial<Record<NotificationChannel, { allowed: boolean; reason?: string }>>;
  delivery: {
    quietHoursEnabled: boolean;
    quietStart: string;
    quietEnd: string;
    quietTimezone: string;
  };
};

const DEFAULT_TRIGGERS: NotificationTrigger[] = ["run_failed", "run_succeeded"];

export function NotificationSettingsForm({ userEmail, prefs, access, delivery }: Props) {
  const [expanded, setExpanded] = useState<string | null>("email");
  const [quietEnabled, setQuietEnabled] = useState(delivery.quietHoursEnabled);
  const [quietStart, setQuietStart] = useState(delivery.quietStart || "22:00");
  const [quietEnd, setQuietEnd] = useState(delivery.quietEnd || "08:00");
  const [quietTz, setQuietTz] = useState(delivery.quietTimezone || "UTC");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; error?: string } | null>>({});

  type ChannelState = {
    enabled: boolean;
    triggers: NotificationTrigger[];
    slackWebhookUrl: string;
    teamsWebhookUrl: string;
    discordWebhookUrl: string;
    pagerdutyRoutingKey: string;
    webhookUrl: string;
    webhookSecret: string;
    webhookPayloadTemplate: string;
    googlechatWebhookUrl: string;
    automationUrl: string;
  };

  function initChannel(ch: NotificationChannel): ChannelState {
    const p = prefs[ch];
    return {
      enabled: p?.enabled ?? false,
      triggers: p?.triggers?.length ? p.triggers : DEFAULT_TRIGGERS,
      slackWebhookUrl: p?.slackWebhookUrl ?? "",
      teamsWebhookUrl: p?.teamsWebhookUrl ?? "",
      discordWebhookUrl: p?.discordWebhookUrl ?? "",
      pagerdutyRoutingKey: p?.pagerdutyRoutingKey ?? "",
      webhookUrl: p?.webhookUrl ?? "",
      webhookSecret: p?.webhookSecret ?? "",
      webhookPayloadTemplate: p?.webhookPayloadTemplate ?? "",
      googlechatWebhookUrl: p?.googlechatWebhookUrl ?? "",
      automationUrl:
        p?.zapierWebhookUrl ?? p?.makeWebhookUrl ?? p?.n8nWebhookUrl ?? p?.pipedreamWebhookUrl ?? "",
    };
  }

  const [state, setState] = useState<Record<NotificationChannel, ChannelState>>(() => ({
    email: initChannel("email"),
    slack: initChannel("slack"),
    teams: initChannel("teams"),
    discord: initChannel("discord"),
    pagerduty: initChannel("pagerduty"),
    webhook: initChannel("webhook"),
    googlechat: initChannel("googlechat"),
    zapier: initChannel("zapier"),
    make: initChannel("make"),
    n8n: initChannel("n8n"),
    pipedream: initChannel("pipedream"),
  }));

  function patchChannel(ch: NotificationChannel, patch: Partial<ChannelState>) {
    setState((s) => ({ ...s, [ch]: { ...s[ch], ...patch } }));
  }

  const channels: ChannelDef[] = [
    {
      id: "email",
      color: "bg-blue-600",
      icon: "✉",
      can: access.email?.allowed ?? false,
      upgradeReason: access.email?.reason,
      subtitle: userEmail,
      configFields: "email",
    },
    {
      id: "slack",
      color: "bg-purple-600",
      icon: "S",
      can: access.slack?.allowed ?? false,
      upgradeReason: access.slack?.reason,
      subtitle: state.slack.slackWebhookUrl ? "Configured" : "Incoming webhook URL",
      configFields: "slack",
    },
    {
      id: "teams",
      color: "bg-cyan-600",
      icon: "T",
      can: access.teams?.allowed ?? false,
      upgradeReason: access.teams?.reason,
      subtitle: state.teams.teamsWebhookUrl ? "Configured" : "Connector webhook URL",
      configFields: "teams",
    },
    {
      id: "discord",
      color: "bg-indigo-600",
      icon: "D",
      can: access.discord?.allowed ?? false,
      upgradeReason: access.discord?.reason,
      subtitle: state.discord.discordWebhookUrl ? "Configured" : "Webhook URL",
      configFields: "discord",
    },
    {
      id: "pagerduty",
      color: "bg-green-600",
      icon: "PD",
      can: access.pagerduty?.allowed ?? false,
      upgradeReason: access.pagerduty?.reason,
      subtitle: "Events API v2 routing key",
      configFields: "pagerduty",
    },
    {
      id: "webhook",
      color: "bg-orange-600",
      icon: "W",
      can: access.webhook?.allowed ?? false,
      upgradeReason: access.webhook?.reason,
      subtitle: "Signed JSON POST",
      configFields: "webhook",
    },
    {
      id: "googlechat",
      color: "bg-emerald-600",
      icon: "G",
      can: access.googlechat?.allowed ?? false,
      upgradeReason: access.googlechat?.reason,
      subtitle: "Space webhook URL",
      configFields: "googlechat",
    },
    {
      id: "zapier",
      color: "bg-amber-600",
      icon: "Z",
      can: access.webhook?.allowed ?? false,
      upgradeReason: access.webhook?.reason,
      subtitle: "Catch hook URL",
      configFields: "automation",
    },
    {
      id: "make",
      color: "bg-violet-600",
      icon: "M",
      can: access.webhook?.allowed ?? false,
      upgradeReason: access.webhook?.reason,
      subtitle: "Scenario webhook URL",
      configFields: "automation",
    },
    {
      id: "n8n",
      color: "bg-rose-600",
      icon: "n8",
      can: access.webhook?.allowed ?? false,
      upgradeReason: access.webhook?.reason,
      subtitle: "Workflow webhook URL",
      configFields: "automation",
    },
    {
      id: "pipedream",
      color: "bg-teal-600",
      icon: "P",
      can: access.webhook?.allowed ?? false,
      upgradeReason: access.webhook?.reason,
      subtitle: "Workflow HTTP trigger",
      configFields: "automation",
    },
  ];

  function handleSave() {
    startTransition(async () => {
      const out: Parameters<typeof saveNotificationSettings>[0]["channels"] = {};
      for (const ch of channels) {
        if (!ch.can) continue;
        const s = state[ch.id];
        out[ch.id] = {
          enabled: s.enabled,
          triggers: s.triggers,
          emailAddress: ch.id === "email" ? userEmail : undefined,
          slackWebhookUrl: ch.id === "slack" ? s.slackWebhookUrl : undefined,
          teamsWebhookUrl: ch.id === "teams" ? s.teamsWebhookUrl : undefined,
          discordWebhookUrl: ch.id === "discord" ? s.discordWebhookUrl : undefined,
          pagerdutyRoutingKey: ch.id === "pagerduty" ? s.pagerdutyRoutingKey : undefined,
          webhookUrl: ch.id === "webhook" ? s.webhookUrl : undefined,
          webhookSecret: ch.id === "webhook" ? s.webhookSecret : undefined,
          webhookPayloadTemplate: ch.id === "webhook" ? s.webhookPayloadTemplate : undefined,
          googlechatWebhookUrl: ch.id === "googlechat" ? s.googlechatWebhookUrl : undefined,
          zapierWebhookUrl: ch.id === "zapier" ? s.automationUrl : undefined,
          makeWebhookUrl: ch.id === "make" ? s.automationUrl : undefined,
          n8nWebhookUrl: ch.id === "n8n" ? s.automationUrl : undefined,
          pipedreamWebhookUrl: ch.id === "pipedream" ? s.automationUrl : undefined,
        };
      }

      const result = await saveNotificationSettings({
        delivery: {
          quietHoursEnabled: quietEnabled,
          quietStart,
          quietEnd,
          quietTimezone: quietTz,
        },
        channels: out,
      });
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  }

  async function handleTest(channel: NotificationChannel) {
    setTestingChannel(channel);
    const result = await sendTestNotification(channel);
    setTestResult((r) => ({ ...r, [channel]: result }));
    setTestingChannel(null);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5 text-slate-500" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Notification channels</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Route pipeline run outcomes and workspace events to email, chat, on-call, or automation webhooks — like
              ServicePulse, tuned for ELT.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {channels.map((ch) => {
            const s = state[ch.id];
            const isOpen = expanded === ch.id;
            return (
              <div
                key={ch.id}
                className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : ch.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${ch.color}`}
                  >
                    {ch.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">{CHANNEL_LABELS[ch.id]}</p>
                    <p className="truncate text-xs text-slate-500">{ch.subtitle}</p>
                  </div>
                  {!ch.can ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <Lock className="h-3 w-3" /> Upgrade
                    </span>
                  ) : (
                    <ToggleSwitch
                      enabled={s.enabled}
                      onToggle={() => patchChannel(ch.id, { enabled: !s.enabled })}
                      disabled={!ch.can}
                    />
                  )}
                </button>

                {isOpen ? (
                  <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">
                    {!ch.can ? (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {ch.upgradeReason}{" "}
                        <Link href="/pricing" className="text-blue-600 hover:underline">
                          View plans
                        </Link>
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {ch.configFields === "slack" ? (
                          <input
                            type="url"
                            value={s.slackWebhookUrl}
                            onChange={(e) => patchChannel("slack", { slackWebhookUrl: e.target.value })}
                            placeholder="https://hooks.slack.com/services/..."
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                          />
                        ) : null}
                        {ch.configFields === "teams" ? (
                          <input
                            type="url"
                            value={s.teamsWebhookUrl}
                            onChange={(e) => patchChannel("teams", { teamsWebhookUrl: e.target.value })}
                            placeholder="https://outlook.office.com/webhook/..."
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                          />
                        ) : null}
                        {ch.configFields === "discord" ? (
                          <input
                            type="url"
                            value={s.discordWebhookUrl}
                            onChange={(e) => patchChannel("discord", { discordWebhookUrl: e.target.value })}
                            placeholder="https://discord.com/api/webhooks/..."
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                          />
                        ) : null}
                        {ch.configFields === "pagerduty" ? (
                          <input
                            type="password"
                            value={s.pagerdutyRoutingKey}
                            onChange={(e) => patchChannel("pagerduty", { pagerdutyRoutingKey: e.target.value })}
                            placeholder="Routing key"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                          />
                        ) : null}
                        {ch.configFields === "webhook" ? (
                          <div className="space-y-2">
                            <input
                              type="url"
                              value={s.webhookUrl}
                              onChange={(e) => patchChannel("webhook", { webhookUrl: e.target.value })}
                              placeholder="https://your-endpoint.example/hooks/eltpulse"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                            />
                            <input
                              type="password"
                              value={s.webhookSecret}
                              onChange={(e) => patchChannel("webhook", { webhookSecret: e.target.value })}
                              placeholder="HMAC secret (optional)"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                            />
                            <textarea
                              value={s.webhookPayloadTemplate}
                              onChange={(e) => patchChannel("webhook", { webhookPayloadTemplate: e.target.value })}
                              placeholder='Optional template — use {{ pipeline.name }}, {{ run.status }}, {{ trigger }}, {{ details }}'
                              rows={4}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
                            />
                          </div>
                        ) : null}
                        {ch.configFields === "googlechat" ? (
                          <input
                            type="url"
                            value={s.googlechatWebhookUrl}
                            onChange={(e) => patchChannel("googlechat", { googlechatWebhookUrl: e.target.value })}
                            placeholder="Google Chat space webhook URL"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                          />
                        ) : null}
                        {ch.configFields === "automation" ? (
                          <input
                            type="url"
                            value={s.automationUrl}
                            onChange={(e) => patchChannel(ch.id, { automationUrl: e.target.value })}
                            placeholder="Automation webhook URL"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                          />
                        ) : null}
                        {ch.configFields === "email" ? (
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Notifications will be sent to <strong>{userEmail}</strong>.
                          </p>
                        ) : null}

                        <TriggerCheckboxes
                          triggers={TRIGGER_GROUPS.flatMap((g) => g.items.map((i) => i.value))}
                          selected={s.triggers}
                          onChange={(triggers) => patchChannel(ch.id, { triggers })}
                        />

                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => void handleTest(ch.id)}
                            disabled={testingChannel === ch.id || !s.enabled}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
                          >
                            {testingChannel === ch.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            Send test
                          </button>
                          {testResult[ch.id] ? (
                            <span
                              className={`text-xs ${testResult[ch.id]?.success ? "text-green-600" : "text-red-600"}`}
                            >
                              {testResult[ch.id]?.success ? "Test sent" : testResult[ch.id]?.error}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold text-slate-900 dark:text-white">Quiet hours</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Pause non-urgent channels during a daily window. PagerDuty is always delivered.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={quietEnabled}
            onChange={(e) => setQuietEnabled(e.target.checked)}
            className="rounded border-slate-300"
          />
          Enable quiet hours
        </label>
        {quietEnabled ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input
              type="time"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              type="time"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              type="text"
              value={quietTz}
              onChange={(e) => setQuietTz(e.target.value)}
              placeholder="Timezone (e.g. America/New_York)"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
        ) : null}
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4" />}
          Save notification settings
        </button>
        {saved ? <span className="text-sm text-green-600">Saved</span> : null}
        <Link href="/account/notification-history" className="text-sm text-blue-600 hover:underline">
          View delivery history →
        </Link>
      </div>
    </div>
  );
}
