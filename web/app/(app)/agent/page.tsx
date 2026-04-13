"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Check, Copy, Eye, EyeOff, Loader2, RefreshCw, RotateCcw, Trash2, Wifi, WifiOff } from "lucide-react";

const CONTROL_PLANE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.eltpulse.dev";

type Heartbeat = { seenAt: string; version: string; labels: Record<string, string> } | null;

function msAgo(ts: string) {
  const delta = Date.now() - new Date(ts).getTime();
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  return `${Math.floor(delta / 3_600_000)}h ago`;
}

function isRecentlyActive(hb: Heartbeat) {
  if (!hb) return false;
  return Date.now() - new Date(hb.seenAt).getTime() < 90_000; // 90s grace
}

type ExecutionPlane = "customer_agent" | "datapulse_managed";

export default function AgentPage() {
  const [hasToken, setHasToken] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [heartbeat, setHeartbeat] = useState<Heartbeat>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [executionPlane, setExecutionPlane] = useState<ExecutionPlane>("customer_agent");
  const [planeSaving, setPlaneSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tokenRes, hbRes] = await Promise.all([
        fetch("/api/agent/token"),
        fetch("/api/agent/heartbeat"),
      ]);
      const tokenData = await tokenRes.json();
      setHasToken(tokenData.hasToken ?? false);
      const plane = tokenData.executionPlane as ExecutionPlane | undefined;
      setExecutionPlane(plane === "datapulse_managed" ? "datapulse_managed" : "customer_agent");
      const hbData = await hbRes.json().catch(() => ({}));
      setHeartbeat(hbData.heartbeat ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  async function persistPlane(plane: ExecutionPlane) {
    if (plane === executionPlane) return;
    setPlaneSaving(true);
    try {
      const res = await fetch("/api/elt/account-execution", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionPlane: plane }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || res.statusText);
      }
      const data = (await res.json()) as { executionPlane: ExecutionPlane };
      setExecutionPlane(data.executionPlane === "datapulse_managed" ? "datapulse_managed" : "customer_agent");
    } catch {
      await load();
    } finally {
      setPlaneSaving(false);
    }
  }

  useEffect(() => { load(); }, [load]);

  // Refresh heartbeat every 30s
  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch("/api/agent/heartbeat").catch(() => null);
      if (res?.ok) {
        const d = await res.json().catch(() => ({}));
        setHeartbeat(d.heartbeat ?? null);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/agent/token", { method: "POST" });
      const data = await res.json();
      setToken(data.token ?? null);
      setHasToken(true);
      setShowToken(true);
    } finally {
      setGenerating(false);
    }
  }

  async function revoke() {
    if (!confirm("Revoke the agent token? Any running agents will stop reporting.")) return;
    await fetch("/api/agent/token", { method: "DELETE" });
    setToken(null);
    setHasToken(false);
    setHeartbeat(null);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const active = isRecentlyActive(heartbeat);
  const masked = token ? token.slice(0, 8) + "•".repeat(20) + token.slice(-4) : "•".repeat(32);

  const dockerCmd = `docker run -d \\
  --name eltpulse-agent \\
  --restart unless-stopped \\
  -e DATAPULSE_AGENT_TOKEN=<YOUR_TOKEN> \\
  -e DATAPULSE_CONTROL_PLANE_URL=${CONTROL_PLANE_URL} \\
  ghcr.io/eltpulsehq/agent:latest`;

  const envFileContent = `# eltPulse Agent — .env
DATAPULSE_AGENT_TOKEN=<YOUR_TOKEN>
DATAPULSE_CONTROL_PLANE_URL=${CONTROL_PLANE_URL}

# Your pipeline credentials go here (agent passes them as env vars when executing runs)
# SNOWFLAKE_ACCOUNT=xy12345
# SNOWFLAKE_USER=datapulse
# SNOWFLAKE_PASSWORD=...
# SOURCE_POSTGRES_HOST=db.internal
# SOURCE_POSTGRES_PASSWORD=...
`;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-sky-600" aria-hidden />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Self-Hosted Agent</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The self-hosted agent is <strong className="font-medium text-slate-700 dark:text-slate-300">optional</strong>.
            Run history and logs always land in eltPulse whether you use an agent, managed compute (when available), or
            report runs from the app / API.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:underline dark:text-sky-400"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Execution preference */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Who runs ingestion</h2>
          {planeSaving ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Saving" /> : null}
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          This is your account preference. Telemetry is stored either way. You do not need an agent token unless you
          want a worker in your network to poll pending runs.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={loading || planeSaving}
            onClick={() => void persistPlane("customer_agent")}
            className={`rounded-lg border p-3 text-left text-sm transition ${
              executionPlane === "customer_agent"
                ? "border-sky-500 bg-sky-50/80 text-slate-900 dark:border-sky-500 dark:bg-sky-950/30 dark:text-white"
                : "border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
            }`}
          >
            <span className="font-medium">You operate execution</span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Optional agent, CI, or session API — warehouse traffic stays on infrastructure you control.
            </span>
          </button>
          <button
            type="button"
            disabled={loading || planeSaving}
            onClick={() => void persistPlane("datapulse_managed")}
            className={`rounded-lg border p-3 text-left text-sm transition ${
              executionPlane === "datapulse_managed"
                ? "border-sky-500 bg-sky-50/80 text-slate-900 dark:border-sky-500 dark:bg-sky-950/30 dark:text-white"
                : "border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
            }`}
          >
            <span className="font-medium">eltPulse-managed</span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              We run ingestion on your behalf when this tier is enabled (roadmap). Same run log UI and webhooks.
            </span>
          </button>
        </div>
      </section>

      {/* Agent status */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${
        active
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
          : hasToken
            ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
            : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50"
      }`}>
        {active ? (
          <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <WifiOff className="h-5 w-5 text-slate-400" />
        )}
        <div>
          <p className={`text-sm font-semibold ${active ? "text-emerald-900 dark:text-emerald-100" : "text-slate-700 dark:text-slate-300"}`}>
            {active ? "Agent online" : hasToken ? "Agent offline or not started" : "No agent configured"}
          </p>
          {heartbeat && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Last seen {msAgo(heartbeat.seenAt)}
              {heartbeat.version !== "unknown" && ` · v${heartbeat.version}`}
              {Object.keys(heartbeat.labels).length > 0 &&
                ` · ${Object.entries(heartbeat.labels).map(([k, v]) => `${k}=${v}`).join(", ")}`}
            </p>
          )}
          {!heartbeat && hasToken && !loading && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              No heartbeat received yet — start the agent to connect.
            </p>
          )}
        </div>
      </div>

      {/* Token management */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Agent token</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          The agent authenticates using this token. Treat it like a password — it grants
          read access to your pipeline definitions and write access to run records.
        </p>

        {loading ? (
          <p className="mt-3 text-sm text-slate-400">Loading…</p>
        ) : token ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Copy this token now — it won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950">
              <span className="flex-1 select-all break-all text-slate-800 dark:text-white">
                {showToken ? token : masked}
              </span>
              <button type="button" onClick={() => setShowToken((v) => !v)} className="shrink-0 text-slate-400 hover:text-slate-600">
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => copy(token)} className="shrink-0 text-slate-400 hover:text-slate-600">
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ) : hasToken ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Token is set. Rotate it below if you need a new one.
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">No token yet.</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!hasToken ? (
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              <Bot className="h-4 w-4" />
              {generating ? "Generating…" : "Generate token"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={generate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-4 w-4" />
                {generating ? "Rotating…" : "Rotate token"}
              </button>
              <button
                type="button"
                onClick={revoke}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/20"
              >
                <Trash2 className="h-4 w-4" />
                Revoke
              </button>
            </>
          )}
        </div>
      </section>

      {/* Setup instructions */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Setup instructions</h2>

        {/* Step 1 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Step 1</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-800 dark:text-white">Generate a token above</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Copy it somewhere safe. You&apos;ll pass it to the agent as an environment variable.
          </p>
        </div>

        {/* Step 2 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Step 2</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-800 dark:text-white">Create a <code className="text-[12px]">.env</code> file</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 mb-2">
            Add your agent token and the credentials your pipelines need. Nothing in this file is sent to eltPulse — it stays on your machine.
          </p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-200">
              {envFileContent}
            </pre>
            <button
              type="button"
              onClick={() => copy(envFileContent)}
              className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:text-white"
              title="Copy"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Step 3 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Step 3</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-800 dark:text-white">Run the agent</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 mb-2">
            Docker is the recommended deployment. Replace <code className="text-[11px]">&lt;YOUR_TOKEN&gt;</code> with the token you generated.
          </p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-200">
              {dockerCmd}
            </pre>
            <button
              type="button"
              onClick={() => copy(dockerCmd)}
              className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:text-white"
              title="Copy"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Or use <code className="text-[11px]">--env-file .env</code> to load from your env file:{" "}
            <code className="text-[11px]">docker run -d --env-file .env ghcr.io/eltpulsehq/agent:latest</code>
          </p>
        </div>

        {/* Step 4 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Step 4</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-800 dark:text-white">Trigger a pipeline run</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Go to <strong>Runs</strong> and start a manual run for any pipeline. The agent will pick it up within seconds,
            execute it, and stream logs back here. You&apos;ll see run status update in real time.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">How the agent works</h2>
        <ul className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 list-inside list-disc">
          <li>Polls <code className="text-[11px]">GET /api/agent/runs?status=pending</code> every few seconds</li>
          <li>Downloads the pipeline manifest (code + config) and executes it locally</li>
          <li>
            Loads stored connector secrets (if any) from{" "}
            <code className="text-[11px]">GET /api/agent/connections</code> and injects them into the run environment —
            same Bearer token as other agent routes
          </li>
          <li>Streams log lines back via <code className="text-[11px]">PATCH /api/agent/runs/:id</code></li>
          <li>Reports final status (succeeded / failed) so you see it in the Runs UI</li>
          <li>Sends a heartbeat every 30s — visible as the green &quot;Agent online&quot; indicator above</li>
          <li>
            Execution and warehouse I/O happen on the agent; secrets you save in Connections are encrypted at rest in
            eltPulse and only returned to your agent over TLS for local use
          </li>
        </ul>
      </section>
    </div>
  );
}
