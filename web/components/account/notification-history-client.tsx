"use client";

import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { describeSkipReason, TRIGGER_LABELS } from "@/lib/notifications/labels";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export type NotificationHistoryRow = {
  id: string;
  createdAt: string;
  channel: string;
  trigger: string;
  subject: string;
  statusCode: number | null;
  nextRetryAt: string | null;
  lastAttemptAt: string | null;
  retryCount: number;
  responseBody: string | null;
  skipReason: string | null;
  sentAt: string | null;
  error: string | null;
};

function getStatusBadge(row: NotificationHistoryRow) {
  if (row.skipReason) {
    return {
      icon: AlertCircle,
      label: `Skipped · ${describeSkipReason(row.skipReason)}`,
      color: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600",
    };
  }
  if (row.sentAt) {
    return {
      icon: CheckCircle2,
      label: "Delivered",
      color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900",
    };
  }
  if (!row.lastAttemptAt) {
    return {
      icon: Clock,
      label: "Pending",
      color: "bg-yellow-50 text-yellow-700 border-yellow-200",
    };
  }
  if (row.nextRetryAt && new Date() < new Date(row.nextRetryAt)) {
    return {
      icon: Clock,
      label: "Retrying",
      color: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }
  return {
    icon: AlertCircle,
    label: "Failed",
    color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900",
  };
}

function channelBadge(channel: string) {
  const colors: Record<string, string> = {
    email: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    slack: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    teams: "bg-cyan-100 text-cyan-700",
    discord: "bg-indigo-100 text-indigo-700",
    pagerduty: "bg-green-100 text-green-700",
    webhook: "bg-orange-100 text-orange-700",
  };
  const cls = colors[channel] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {channel}
    </span>
  );
}

export function NotificationHistoryClient({ events }: { events: NotificationHistoryRow[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500 dark:border-slate-700">
        No notification history yet. Configure channels under Notifications — delivery attempts appear here with sent,
        failed, or skipped status.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Time</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Channel</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Trigger</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {events.map((event) => {
              const status = getStatusBadge(event);
              const StatusIcon = status.icon;
              const triggerLabel =
                TRIGGER_LABELS[event.trigger as keyof typeof TRIGGER_LABELS] ?? event.trigger.replace(/_/g, " ");
              return (
                <tr key={event.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">
                    {formatDateTime(event.createdAt)}
                  </td>
                  <td className="px-4 py-3">{channelBadge(event.channel)}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{triggerLabel}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${status.color}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-600 dark:text-slate-400">
                    <p className="truncate">{event.subject}</p>
                    {event.error ? <p className="mt-0.5 truncate text-xs text-red-600">{event.error}</p> : null}
                    {event.statusCode ? <p className="text-xs text-slate-500">HTTP {event.statusCode}</p> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
