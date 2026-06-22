"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import type { PlanTier } from "@prisma/client";

type ExportSettings = {
  organizationId: string | null;
  allowed: boolean;
  metadataStorageMode: "cloud" | "customer_export";
  hasWebhookUrl: boolean;
  hasWebhookSecret: boolean;
  webhookUrlPreview: string | null;
};

export function AirgapMetadataPanel({ tier }: { tier?: PlanTier }) {
  const [settings, setSettings] = useState<ExportSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"cloud" | "customer_export">("cloud");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/organization/metadata-export", { credentials: "same-origin" });
      const data = (await res.json()) as ExportSettings & { error?: string };
      setSettings(data);
      if (data.metadataStorageMode) setMode(data.metadataStorageMode);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/organization/metadata-export", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadataStorageMode: mode,
          metadataExportWebhookUrl: webhookUrl.trim() || null,
          ...(webhookSecret.trim() ? { metadataExportWebhookSecret: webhookSecret.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMessage("Settings saved.");
      setWebhookSecret("");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function testWebhook() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/organization/metadata-export", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = (await res.json()) as { error?: string; httpStatus?: number };
      if (!res.ok) throw new Error(data.error ?? "Test failed");
      setMessage(`Test delivered (HTTP ${data.httpStatus ?? 200}).`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading metadata export settings…</p>;
  }

  if (!settings?.organizationId) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Create an organization to configure air-gapped metadata export.
      </p>
    );
  }

  if (!settings.allowed) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Air-gapped metadata export is included on Team and Enterprise
        {tier ? ` (current plan: ${tier})` : ""}.{" "}
        <Link href="/account/billing" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          Upgrade to Team
        </Link>{" "}
        or contact{" "}
        <a href="mailto:hello@eltpulse.dev" className="font-medium text-blue-600 hover:underline">
          hello@eltpulse.dev
        </a>{" "}
        for Enterprise.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void save(e)} className="mt-4 space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Mirrors redacted run summaries (status, row counts, errors — no raw logs) to your HTTPS endpoint on every
        terminal run. After a successful export, verbose logs and telemetry samples are redacted in eltPulse Cloud (v2).
      </p>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Storage mode</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "cloud" | "customer_export")}
          className="mt-1 block w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
        >
          <option value="cloud">Cloud (default)</option>
          <option value="customer_export">Customer export webhook</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Export webhook URL</label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder={settings.hasWebhookUrl ? "Leave blank to keep existing URL" : "https://vault.example.com/eltpulse/metadata"}
          className="mt-1 block w-full max-w-lg rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
        />
        {settings.webhookUrlPreview ? (
          <p className="mt-1 text-xs text-slate-500">Current: {settings.webhookUrlPreview}</p>
        ) : null}
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Signing secret (optional)
        </label>
        <input
          type="password"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder={settings.hasWebhookSecret ? "Leave blank to keep existing secret" : "Min 8 characters"}
          className="mt-1 block w-full max-w-lg rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
        />
        <p className="mt-1 text-xs text-slate-500">
          Sent as <code className="text-xs">X-eltPulse-Signature</code> (HMAC-SHA256 of body).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </button>
        <button
          type="button"
          disabled={testing || !settings.hasWebhookUrl}
          onClick={() => void testWebhook()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send test
        </button>
      </div>

      {message ? <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p> : null}
    </form>
  );
}
