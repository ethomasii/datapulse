"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { AuditEventRow } from "@/lib/audit/workspace-audit";
import { formatAuditAction } from "@/lib/audit/workspace-audit";

function formatDetail(detail: Record<string, unknown>): string {
  const parts = Object.entries(detail)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.length ? parts.join(" · ") : "—";
}

function toCsv(events: AuditEventRow[]): string {
  const header = "time,actor,action,detail";
  const lines = events.map((e) => {
    const detail = JSON.stringify(e.detail).replaceAll('"', '""');
    return `"${e.createdAt}","${e.actorEmail.replaceAll('"', '""')}","${e.action.replaceAll('"', '""')}","${detail}"`;
  });
  return [header, ...lines].join("\n");
}

export function AuditLogClient() {
  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account/audit-log", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as { events?: AuditEventRow[]; migrationPending?: boolean };
      setEvents(data.events ?? []);
      setMigrationPending(Boolean(data.migrationPending) && (data.events?.length ?? 0) === 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    const blob = new Blob([toCsv(events)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eltpulse-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading activity…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {events.length} event{events.length === 1 ? "" : "s"} recorded for this workspace.
        </p>
        {events.length > 0 ? (
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export CSV
          </button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50">
            <tr>
              <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">Time</th>
              <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">Actor</th>
              <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-slate-500 dark:text-slate-500">
                  {migrationPending
                    ? "No events yet — new workspace actions will appear here after the audit table is migrated."
                    : "No audit events recorded yet. Organization, pipeline, invite, API key, and notification actions are logged automatically."}
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-600 dark:text-slate-400">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-slate-800 dark:text-slate-200">{e.actorEmail}</td>
                  <td className="px-4 py-2">
                    <span className="font-medium text-slate-900 dark:text-white">{formatAuditAction(e.action)}</span>
                    <span className="ml-2 text-xs text-slate-400">{e.action}</span>
                    {Object.keys(e.detail).length > 0 ? (
                      <p className="mt-0.5 text-xs text-slate-500">{formatDetail(e.detail)}</p>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
