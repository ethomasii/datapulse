'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCopy,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  Waypoints,
  Webhook,
  Zap,
} from 'lucide-react';
import { RelatedLinks } from "@/components/ui/related-links";

type PipelineRow = { id: string; name: string; webhookUrl: string | null };

export default function WebhooksPage() {
  // ── Outgoing webhooks ──────────────────────────────────────────────────────
  const [globalUrl, setGlobalUrl] = useState('');
  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loadingOut, setLoadingOut] = useState(true);

  // ── Incoming webhook token ─────────────────────────────────────────────────
  const [hasToken, setHasToken] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null); // shown once after generate
  const [showToken, setShowToken] = useState(false);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [loadingIn, setLoadingIn] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // ── Loads ──────────────────────────────────────────────────────────────────
  const loadOutgoing = useCallback(async () => {
    setLoadingOut(true);
    try {
      const res = await fetch('/api/elt/runs/webhook');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json() as { globalUrl?: string | null; url?: string | null; pipelines?: PipelineRow[] };
      setGlobalUrl(data.globalUrl ?? data.url ?? '');
      const pipes = data.pipelines ?? [];
      setPipelines(pipes);
      const d: Record<string, string> = {};
      for (const p of pipes) d[p.id] = p.webhookUrl ?? '';
      setDrafts(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load webhooks');
    } finally {
      setLoadingOut(false);
    }
  }, []);

  const loadIncoming = useCallback(async () => {
    setLoadingIn(true);
    try {
      const res = await fetch('/api/webhooks/incoming-token');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json() as { hasToken: boolean };
      setHasToken(data.hasToken);
    } finally {
      setLoadingIn(false);
    }
  }, []);

  useEffect(() => { void loadOutgoing(); void loadIncoming(); }, [loadOutgoing, loadIncoming]);

  function flash(key: string) { setSaved(key); setTimeout(() => setSaved(null), 2000); }

  // ── Outgoing actions ───────────────────────────────────────────────────────
  async function saveGlobal() {
    setSaving('global'); setError(null);
    try {
      const res = await fetch('/api/elt/runs/webhook', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: globalUrl.trim() || null }),
      });
      if (!res.ok) throw new Error('Save failed');
      flash('global'); await loadOutgoing();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(null); }
  }

  async function savePipeline(id: string) {
    setSaving(id); setError(null);
    try {
      const res = await fetch(`/api/elt/pipelines/${id}/webhook`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: drafts[id]?.trim() || null }),
      });
      if (!res.ok) throw new Error('Save failed');
      flash(id); await loadOutgoing();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(null); }
  }

  function effectiveUrl(pipe: PipelineRow): string | null {
    return pipe.webhookUrl?.trim() || globalUrl.trim() || null;
  }

  // ── Incoming token actions ─────────────────────────────────────────────────
  async function generateToken() {
    if (!confirm('This will invalidate your existing token. Any integrations using the old URL will stop working. Continue?')) return;
    setTokenBusy(true); setError(null); setNewToken(null);
    try {
      const res = await fetch('/api/webhooks/incoming-token', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate token');
      const data = await res.json() as { token: string };
      setNewToken(data.token);
      setHasToken(true);
      setShowToken(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setTokenBusy(false); }
  }

  async function revokeToken() {
    if (!confirm('Revoke the incoming webhook token? All trigger URLs using this token will immediately stop working.')) return;
    setTokenBusy(true); setError(null);
    try {
      await fetch('/api/webhooks/incoming-token', { method: 'DELETE' });
      setHasToken(false); setNewToken(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setTokenBusy(false); }
  }

  const appBase = typeof window !== 'undefined' ? window.location.origin : '';
  const triggerUrl = newToken ? `${appBase}/api/webhooks/trigger/${newToken}` : null;

  return (
    <div className="w-full min-w-0 max-w-4xl mx-auto space-y-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <Webhook className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Webhooks</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Webhooks</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Two-way webhook integration: <strong className="font-medium text-slate-800 dark:text-slate-200">outgoing</strong> webhooks
          notify your systems when a run finishes, and an{' '}
          <strong className="font-medium text-slate-800 dark:text-slate-200">incoming</strong> trigger URL lets external
          systems launch pipeline runs without a Clerk session.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="mt-1 text-xs text-red-600 dark:text-red-400">Dismiss</button>
        </div>
      )}

      {/* ── Incoming webhook trigger ────────────────────────────────────────── */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6 dark:border-amber-800 dark:bg-amber-900/10">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Incoming trigger</h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            New
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Generate a secret trigger URL. Any system that can send an HTTPS{' '}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">POST</code> — GitHub Actions, Zapier,
          Make, curl — can launch a pipeline run without a Clerk session. The token is the only auth; keep it secret.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void generateToken()}
            disabled={tokenBusy || loadingIn}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {tokenBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {hasToken ? 'Rotate token' : 'Generate token'}
          </button>
          {hasToken && !newToken && (
            <button
              type="button"
              onClick={() => void revokeToken()}
              disabled={tokenBusy}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Revoke
            </button>
          )}
        </div>

        {hasToken && !newToken && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-700 dark:bg-slate-900">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-slate-600 dark:text-slate-300">A token is active. Rotate to get a new URL shown once.</span>
          </div>
        )}

        {newToken && triggerUrl && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-amber-300 bg-white p-4 dark:border-amber-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400">
                  Your trigger URL — copy now, shown once
                </span>
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-slate-100 px-2 py-1.5 text-xs dark:bg-slate-950 dark:text-slate-200">
                  {showToken ? triggerUrl : triggerUrl.replace(/\/[a-f0-9]{40,}$/, '/••••••••••••••••••••')}
                </code>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(triggerUrl)}
                  className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Copy URL"
                >
                  <ClipboardCopy className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                This is the only time the full URL is shown. Store it in your secrets manager now.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Example request:</p>
              <pre className="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
{`curl -X POST "${showToken ? triggerUrl : '<your-trigger-url>'}" \\
  -H "Content-Type: application/json" \\
  -d '{"pipeline": "my_pipeline_name", "environment": "prod"}'`}
              </pre>
              <p className="mt-2 text-xs text-slate-500">
                Optional body fields: <code className="font-mono">environment</code> (default: <code className="font-mono">&quot;webhook&quot;</code>),{' '}
                <code className="font-mono">correlationId</code> (default: random UUID).
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Outgoing: Account Default ───────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Outgoing — account default</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Fires for any run that doesn&apos;t have a pipeline-specific override when it reaches a terminal state.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Endpoint URL</label>
            <input
              type="url" value={globalUrl} onChange={e => setGlobalUrl(e.target.value)}
              placeholder="https://example.com/hooks/eltpulse"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <button
            type="button" onClick={() => void saveGlobal()} disabled={saving === 'global'}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {saving === 'global' ? <Loader2 className="h-4 w-4 animate-spin" /> : saved === 'global' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}
            {saved === 'global' ? 'Saved' : 'Save default'}
          </button>
        </div>
      </section>

      {/* ── Outgoing: Per-pipeline overrides ────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Outgoing — per-pipeline overrides</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Pipeline URL takes priority over the account default for that pipeline&apos;s runs.
        </p>
        <div className="mt-1 inline-flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>You can also set these in the <Link href="/builder" className="font-medium underline">Pipeline Builder</Link>.</span>
        </div>

        {loadingOut ? (
          <div className="mt-6 flex items-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading pipelines…</span>
          </div>
        ) : pipelines.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
            <p className="text-sm text-slate-500">No pipelines yet.</p>
            <Link href="/builder" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
              Create a pipeline <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {pipelines.map(pipe => (
              <div key={pipe.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <Link href={`/builder?pipeline=${encodeURIComponent(pipe.id)}`} className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                  {pipe.name}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">
                  Effective: <span className="font-mono">{effectiveUrl(pipe) ?? 'None'}</span>
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="url" value={drafts[pipe.id] ?? ''}
                    onChange={e => setDrafts(prev => ({ ...prev, [pipe.id]: e.target.value }))}
                    placeholder="Pipeline-specific URL (leave blank to inherit default)"
                    className="flex-1 min-w-0 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    type="button" onClick={() => void savePipeline(pipe.id)} disabled={saving === pipe.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    {saving === pipe.id ? <Loader2 className="h-3 w-3 animate-spin" /> : saved === pipe.id ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : null}
                    {saved === pipe.id ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Payload reference ───────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Outgoing payload shape</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
{`{
  "event":         "run.succeeded" | "run.failed" | "run.cancelled",
  "correlationId": "your-ci-job-id",
  "pipelineId":    "clxxxxxxxx",
  "pipelineName":  "my_pipeline",
  "status":        "succeeded",
  "environment":   "prod",
  "startedAt":     "2025-01-01T00:00:00.000Z",
  "finishedAt":    "2025-01-01T00:01:23.456Z",
  "triggeredBy":   "schedule:daily_7am" | "sensor:s3_watch" | "incoming_webhook" | null
}`}
        </pre>
      </section>

      <RelatedLinks links={[
        { href: "/runs", icon: Play, label: "Runs", desc: "View the executions that fire these webhooks" },
        { href: "/builder", icon: Layers, label: "Pipelines", desc: "Set per-pipeline webhook URL overrides" },
        { href: "/orchestration", icon: Waypoints, label: "Orchestration", desc: "Sensors and schedules that trigger runs" },
        { href: "/gateway", icon: Webhook, label: "Gateway & execution", desc: "Configure where ingestion runs" },
      ]} />
    </div>
  );
}
