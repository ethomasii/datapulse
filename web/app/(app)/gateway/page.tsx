"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Layers, Loader2, Play, Plus, RefreshCw, Star, Trash2, Waypoints, Webhook, Wifi, WifiOff } from "lucide-react";
import { RelatedLinks } from "@/components/ui/related-links";

const CONTROL_PLANE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.eltpulse.dev";

type Heartbeat = {
  seenAt: string;
  version: string;
  labels: Record<string, string>;
  source?: string;
} | null;

type ConnectorRow = {
  id: string;
  name: string;
  metadata: unknown;
  heartbeat: Heartbeat | null;
  createdAt: string;
};

function msAgo(ts: string) {
  const delta = Date.now() - new Date(ts).getTime();
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  return `${Math.floor(delta / 3_600_000)}h ago`;
}

function isRecentlyActive(hb: Heartbeat) {
  if (!hb) return false;
  return Date.now() - new Date(hb.seenAt).getTime() < 90_000;
}

type ExecutionPlane = "customer_agent" | "eltpulse_managed";

export default function GatewayPage() {
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [hasAccountToken, setHasAccountToken] = useState(false);
  const [hasAnyToken, setHasAnyToken] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [heartbeat, setHeartbeat] = useState<Heartbeat>(null);
  const [defaultAgentTokenId, setDefaultAgentTokenId] = useState<string | null>(null);
  const [defaultSaving, setDefaultSaving] = useState(false);
  const [workspaceOrg, setWorkspaceOrg] = useState<{ id: string; name: string } | null>(null);
  const [orgConnectors, setOrgConnectors] = useState<ConnectorRow[]>([]);
  const [orgDefaultAgentTokenId, setOrgDefaultAgentTokenId] = useState<string | null>(null);
  const [orgGatewaysAllowed, setOrgGatewaysAllowed] = useState(false);
  const [orgDefaultSaving, setOrgDefaultSaving] = useState(false);
  const [creatingOrgConnector, setCreatingOrgConnector] = useState(false);
  const [newOrgConnectorName, setNewOrgConnectorName] = useState("");
  const [newOrgConnectorMeta, setNewOrgConnectorMeta] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingConnector, setCreatingConnector] = useState(false);
  const [executionPlane, setExecutionPlane] = useState<ExecutionPlane>("customer_agent");
  const [planeSaving, setPlaneSaving] = useState(false);
  /** When eltPulse-managed: hide Docker/token setup until the user expands (SaaS default). */
  const [showSelfHostedSetup, setShowSelfHostedSetup] = useState(false);
  const [newConnectorName, setNewConnectorName] = useState("");
  const [newConnectorMeta, setNewConnectorMeta] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusRes = await fetch("/api/elt/agent-status", { credentials: "same-origin" });
      const s = (await statusRes.json()) as {
        connectors?: ConnectorRow[];
        organization?: {
          id: string;
          name: string;
          defaultAgentTokenId?: string | null;
          orgGatewaysAllowed?: boolean;
          connectors?: ConnectorRow[];
        } | null;
        hasAccountToken?: boolean;
        hasAnyToken?: boolean;
        heartbeat?: Heartbeat;
        defaultAgentTokenId?: string | null;
        executionPlane?: ExecutionPlane | "datapulse_managed";
      };
      setConnectors(Array.isArray(s.connectors) ? s.connectors : []);
      if (s.organization) {
        setWorkspaceOrg({ id: s.organization.id, name: s.organization.name });
        setOrgConnectors(Array.isArray(s.organization.connectors) ? s.organization.connectors : []);
        setOrgDefaultAgentTokenId(s.organization.defaultAgentTokenId ?? null);
        setOrgGatewaysAllowed(Boolean(s.organization.orgGatewaysAllowed));
      } else {
        setWorkspaceOrg(null);
        setOrgConnectors([]);
        setOrgDefaultAgentTokenId(null);
        setOrgGatewaysAllowed(false);
      }
      setHasAccountToken(Boolean(s.hasAccountToken));
      setHasAnyToken(Boolean(s.hasAnyToken));
      setHeartbeat(s.heartbeat ?? null);
      setDefaultAgentTokenId(s.defaultAgentTokenId ?? null);
      setExecutionPlane(
        s.executionPlane === "eltpulse_managed" || s.executionPlane === "datapulse_managed"
          ? "eltpulse_managed"
          : "customer_agent"
      );
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
      const data = (await res.json()) as { executionPlane: ExecutionPlane | "datapulse_managed" };
      setExecutionPlane(
        data.executionPlane === "eltpulse_managed" || data.executionPlane === "datapulse_managed"
          ? "eltpulse_managed"
          : "customer_agent"
      );
      await load();
    } catch {
      await load();
    } finally {
      setPlaneSaving(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (executionPlane === "customer_agent") {
      setShowSelfHostedSetup(true);
    } else {
      setShowSelfHostedSetup(false);
    }
  }, [executionPlane]);

  useEffect(() => {
    const id = setInterval(() => {
      void load();
    }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  async function persistOrgDefault(id: string | null) {
    if (!workspaceOrg) return;
    setOrgDefaultSaving(true);
    try {
      const res = await fetch("/api/organization/gateway-default", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ defaultAgentTokenId: id }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        alert(t || "Could not update org default gateway");
        return;
      }
      await load();
    } finally {
      setOrgDefaultSaving(false);
    }
  }

  async function persistAccountDefault(id: string | null) {
    setDefaultSaving(true);
    try {
      const res = await fetch("/api/agent/gateway-default", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ defaultAgentTokenId: id }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        alert(t || "Could not update default gateway");
        return;
      }
      await load();
    } finally {
      setDefaultSaving(false);
    }
  }

  async function addNamedConnector() {
    const name = newConnectorName.trim();
    if (!name) return;
    let metadata: Record<string, unknown> | undefined;
    const raw = newConnectorMeta.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          alert("Metadata must be a JSON object, e.g. {\"cloud\":\"aws\",\"region\":\"us-east-1\"}");
          return;
        }
        metadata = parsed as Record<string, unknown>;
      } catch {
        alert("Invalid JSON in metadata");
        return;
      }
    }
    setCreatingConnector(true);
    try {
      const res = await fetch("/api/agent/tokens", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...(metadata ? { metadata } : {}) }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok) {
        alert(data.error || "Failed to create named gateway");
        return;
      }
      setToken(data.token ?? null);
      setShowToken(true);
      setNewConnectorName("");
      setNewConnectorMeta("");
      await load();
    } finally {
      setCreatingConnector(false);
    }
  }

  async function addOrgNamedConnector() {
    if (!workspaceOrg) return;
    const name = newOrgConnectorName.trim();
    if (!name) return;
    let metadata: Record<string, unknown> | undefined;
    const raw = newOrgConnectorMeta.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          alert("Metadata must be a JSON object, e.g. {\"cloud\":\"aws\",\"region\":\"us-east-1\"}");
          return;
        }
        metadata = parsed as Record<string, unknown>;
      } catch {
        alert("Invalid JSON in metadata");
        return;
      }
    }
    setCreatingOrgConnector(true);
    try {
      const res = await fetch("/api/agent/tokens", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          organizationId: workspaceOrg.id,
          ...(metadata ? { metadata } : {}),
        }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok) {
        alert(data.error || "Failed to create org gateway token");
        return;
      }
      setToken(data.token ?? null);
      setShowToken(true);
      setNewOrgConnectorName("");
      setNewOrgConnectorMeta("");
      await load();
    } finally {
      setCreatingOrgConnector(false);
    }
  }

  async function revokeConnector(id: string) {
    if (!confirm("Revoke this named gateway's token? Processes using it will stop authenticating.")) return;
    const res = await fetch(`/api/agent/tokens/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      alert(t || "Revoke failed");
      return;
    }
    await load();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const summaryActive = isRecentlyActive(heartbeat);
  const masked = token ? token.slice(0, 8) + "•".repeat(20) + token.slice(-4) : "•".repeat(32);

  const dockerCmd = `docker run -d \\
  --name eltpulse-gateway \\
  --restart unless-stopped \\
  -e ELTPULSE_AGENT_TOKEN=<YOUR_TOKEN> \\
  -e ELTPULSE_CONTROL_PLANE_URL=${CONTROL_PLANE_URL} \\
  ghcr.io/eltpulsehq/gateway:latest`;

  const envFileContent = `# eltPulse gateway — .env
ELTPULSE_AGENT_TOKEN=<YOUR_TOKEN>
ELTPULSE_CONTROL_PLANE_URL=${CONTROL_PLANE_URL}

# Pipeline credentials stay on the gateway host (passed into runs as env)
# SNOWFLAKE_ACCOUNT=xy12345
# SNOWFLAKE_USER=elt_svc
# SNOWFLAKE_PASSWORD=...
# SOURCE_POSTGRES_HOST=db.internal
# SOURCE_POSTGRES_PASSWORD=...
`;

  const selfHostedSectionsVisible =
    executionPlane === "customer_agent" || showSelfHostedSetup;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Waypoints className="h-5 w-5 text-sky-600" aria-hidden />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gateway &amp; execution</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Choose who runs ingestion below. With <strong className="font-medium text-slate-700 dark:text-slate-300">eltPulse-managed</strong>, we
            operate connectivity, run ingestion, and collect run metrics in your workspace—the same Runs page, logs,
            and webhooks you expect from a SaaS product. You do not need a self-hosted gateway for typical paths (for
            example GitHub or a supported API to a warehouse you connect in the app).
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            A <strong className="font-medium text-slate-800 dark:text-slate-200">gateway</strong> is only required when
            execution or credentials must stay on <em>your</em> network—private VPC datastores, air-gapped sources, or
            policy that forbids eltPulse from touching the data plane. Then use a gateway (Bearer token) so a process
            you control talks to our API; routes are <code className="text-[11px]">/api/agent/*</code> to match the open-source gateway image.
          </p>
          {executionPlane === "customer_agent" ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Multiple gateways: generate a token per process, then mark one as your{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">account default</span> for unrouted runs.
              Each pipeline can still set its own default gateway on the Pipelines page (or &quot;Any gateway&quot;). Optional{" "}
              <code className="text-[11px]">targetAgentTokenId</code> on{" "}
              <code className="text-[11px]">POST /api/elt/runs</code> overrides per run.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:underline dark:text-sky-400"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Who runs ingestion</h2>
          {planeSaving ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Saving" /> : null}
        </div>
        <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          Current preference:{" "}
          <span className="text-sky-700 dark:text-sky-300">
            {executionPlane === "eltpulse_managed" ? "eltPulse-managed" : "Your infrastructure (gateway / CI / API)"}
          </span>
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Changing this updates your account immediately. It does not rotate tokens.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={loading || planeSaving}
            onClick={() => void persistPlane("customer_agent")}
            className={`rounded-lg border p-3 text-left text-sm transition ${
              executionPlane === "customer_agent"
                ? "border-sky-500 bg-sky-50/80 ring-2 ring-sky-400/60 text-slate-900 dark:border-sky-500 dark:bg-sky-950/30 dark:text-white dark:ring-sky-600/50"
                : "border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
            }`}
          >
            <span className="font-medium">You operate execution</span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Optional gateway, CI, or session API — warehouse traffic stays on infrastructure you control.
            </span>
          </button>
          <button
            type="button"
            disabled={loading || planeSaving}
            onClick={() => void persistPlane("eltpulse_managed")}
            className={`rounded-lg border p-3 text-left text-sm transition ${
              executionPlane === "eltpulse_managed"
                ? "border-violet-500 bg-violet-50/90 ring-2 ring-violet-400/70 text-slate-900 dark:border-violet-500 dark:bg-violet-950/40 dark:text-white dark:ring-violet-500/50"
                : "border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
            }`}
          >
            <span className="font-medium">eltPulse-managed</span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              eltPulse runs pending work on our infrastructure—connectivity, ingestion, and run telemetry in your
              workspace. The default for SaaS-style pipelines.
            </span>
          </button>
        </div>
        {executionPlane === "eltpulse_managed" ? (
          <div className="mt-4 rounded-lg border border-violet-200/80 bg-violet-50/50 px-3 py-2.5 dark:border-violet-900/50 dark:bg-violet-950/25">
            <p className="text-xs text-violet-950 dark:text-violet-100/95">
              <span className="font-semibold">While this mode is selected:</span> pending runs use eltPulse-managed workers
              by default—no Docker or token required. The button below only{" "}
              <span className="font-medium">reveals</span> gateway setup for hybrid teams; it does not switch you to
              &quot;You operate execution.&quot;
            </p>
            {heartbeat?.source === "eltpulse_managed" || heartbeat?.source === "datapulse_managed" ? (
              <p className="mt-2 text-xs text-violet-900/85 dark:text-violet-200/85">
                Last managed worker activity {msAgo(heartbeat.seenAt)}
                {heartbeat.version !== "unknown" ? ` · v${heartbeat.version}` : ""}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {workspaceOrg ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Organization gateways — {workspaceOrg.name}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Shared with this Clerk org workspace. Unrouted runs in org context use the org default when set, then your
            personal default.{" "}
            {!orgGatewaysAllowed ? (
              <span className="font-medium text-amber-800 dark:text-amber-200">
                Pro or Team on the org owner is required to create new org-scoped tokens.
              </span>
            ) : null}
          </p>
          {!loading && orgConnectors.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No org-scoped gateways yet.</p>
          ) : !loading && orgConnectors.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {orgConnectors.map((c) => {
                const isDefault = orgDefaultAgentTokenId === c.id;
                return (
                  <li
                    key={c.id}
                    className={`rounded-lg border p-4 dark:border-slate-700 ${
                      isDefault
                        ? "border-violet-300 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/30"
                        : "border-slate-200 bg-white dark:bg-slate-900/80"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.name}</p>
                          {isDefault ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                              <Star className="h-3 w-3 fill-current" aria-hidden />
                              Org default
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {c.heartbeat
                            ? `Last seen ${msAgo(c.heartbeat.seenAt)} · ${
                                c.heartbeat.source === "eltpulse_managed" || c.heartbeat.source === "datapulse_managed"
                                  ? "managed"
                                  : "self-hosted"
                              }`
                            : "Never connected"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!isDefault ? (
                          <button
                            type="button"
                            disabled={orgDefaultSaving}
                            onClick={() => void persistOrgDefault(c.id)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Set as org default
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={orgDefaultSaving}
                            onClick={() => void persistOrgDefault(null)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            Clear org default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void revokeConnector(c.id)}
                          className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {orgGatewaysAllowed ? (
            <div className="mt-4 space-y-2 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">New org-scoped token</p>
              <input
                type="text"
                value={newOrgConnectorName}
                onChange={(e) => setNewOrgConnectorName(e.target.value)}
                placeholder="Label (e.g. shared VPC prod)"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <textarea
                value={newOrgConnectorMeta}
                onChange={(e) => setNewOrgConnectorMeta(e.target.value)}
                placeholder='e.g. {"cloud":"aws"} or {"pipelineRunIsolation":"spawn"}'
                rows={2}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="button"
                disabled={creatingOrgConnector || !newOrgConnectorName.trim()}
                onClick={() => void addOrgNamedConnector()}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {creatingOrgConnector ? "Generating…" : "Generate org token"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {executionPlane === "eltpulse_managed" && !selfHostedSectionsVisible ? (
        <button
          type="button"
          onClick={() => setShowSelfHostedSetup(true)}
          className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-sky-400 hover:bg-sky-50/50 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:bg-sky-950/30"
        >
          <span className="font-medium text-slate-900 dark:text-white">Show gateway setup (advanced)</span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
            Docker, tokens, and named gateways—only if you also run some workloads on your network. Does not change the
            choice above.
          </span>
        </button>
      ) : null}

      {executionPlane === "customer_agent" ? (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 ${
            summaryActive
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
              : hasAnyToken
                ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
                : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50"
          }`}
        >
          {summaryActive ? (
            <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <WifiOff className="h-5 w-5 text-slate-400" />
          )}
          <div>
            <p
              className={`text-sm font-semibold ${
                summaryActive ? "text-emerald-900 dark:text-emerald-100" : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {summaryActive
                ? "At least one gateway recently reported"
                : hasAnyToken
                  ? "No recent heartbeat"
                  : "No gateway tokens yet"}
            </p>
            {heartbeat ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="mr-1.5 inline-flex rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {heartbeat.source === "eltpulse_managed" ? "eltPulse-managed" : "Your gateway"}
                </span>
                Last activity {msAgo(heartbeat.seenAt)}
                {heartbeat.version !== "unknown" && ` · v${heartbeat.version}`}
              </p>
            ) : hasAnyToken && !loading ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">Start a gateway with a token to see heartbeats.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {selfHostedSectionsVisible ? (
        <>
          {executionPlane === "eltpulse_managed" ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowSelfHostedSetup(false)}
                className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
              >
                Hide self-hosted setup
              </button>
            </div>
          ) : null}

          {executionPlane === "eltpulse_managed" ? (
            <div
              className={`flex items-center gap-3 rounded-xl border p-4 ${
                summaryActive
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                  : hasAnyToken
                    ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
                    : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50"
              }`}
            >
              {summaryActive ? (
                <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <WifiOff className="h-5 w-5 text-slate-400" />
              )}
              <div>
                <p
                  className={`text-sm font-semibold ${
                    summaryActive ? "text-emerald-900 dark:text-emerald-100" : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {summaryActive
                    ? "Self-hosted gateway recently reported"
                    : hasAnyToken
                      ? "No recent self-hosted heartbeat"
                      : "No self-hosted gateway tokens"}
                </p>
                {heartbeat && heartbeat.source !== "eltpulse_managed" ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="mr-1.5 inline-flex rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      Your gateway
                    </span>
                    Last activity {msAgo(heartbeat.seenAt)}
                    {heartbeat.version !== "unknown" && ` · v${heartbeat.version}`}
                  </p>
                ) : hasAnyToken && !loading ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Start a gateway with a token below to see heartbeats here.
                  </p>
                ) : !hasAnyToken && !loading ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Managed execution does not require tokens; add one only for hybrid self-hosted runs.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Gateway tokens</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Generate one secret Bearer token per gateway process (same <code className="text-[11px]">Authorization: Bearer</code>{" "}
          header for all <code className="text-[11px]">/api/agent/*</code> calls). With several tokens, choose which one is
          the <span className="font-medium text-slate-600 dark:text-slate-300">account default</span>: that gateway receives
          runs that do not specify a pipeline-level default and do not pass{" "}
          <code className="text-[11px]">targetAgentTokenId</code>. Pipelines can still override per pipeline on the
          Pipelines page.
        </p>

        {!loading && connectors.length >= 2 && !defaultAgentTokenId ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            You have more than one token — set an account default so unrouted runs always go to one gateway.
          </p>
        ) : null}

        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Loading…</p>
        ) : connectors.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            No tokens yet. Generate one below, then use it in <code className="text-[11px]">ELTPULSE_AGENT_TOKEN</code>.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {connectors.map((c) => {
              const isDefault = defaultAgentTokenId === c.id;
              return (
                <li
                  key={c.id}
                  className={`rounded-lg border p-4 dark:border-slate-700 ${
                    isDefault
                      ? "border-violet-300 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/30"
                      : "border-slate-200 bg-white dark:bg-slate-900/80"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.name}</p>
                        {isDefault ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            <Star className="h-3 w-3 fill-current" aria-hidden />
                            Account default
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {c.heartbeat
                          ? `Last seen ${msAgo(c.heartbeat.seenAt)} · ${c.heartbeat.source === "eltpulse_managed" || c.heartbeat.source === "datapulse_managed" ? "managed" : "self-hosted"}`
                          : "Never connected"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!isDefault ? (
                        <button
                          type="button"
                          disabled={defaultSaving}
                          onClick={() => void persistAccountDefault(c.id)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Set as account default
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={defaultSaving}
                          onClick={() => void persistAccountDefault(null)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Clear default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void revokeConnector(c.id)}
                        className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 space-y-2 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Generate a new token</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Label this gateway (e.g. region or environment). Optional JSON metadata can include{" "}
            <code className="text-[10px]">pipelineRunIsolation</code> /{" "}
            <code className="text-[10px]">monitorCheckIsolation</code> (<code className="text-[10px]">inline</code> or{" "}
            <code className="text-[10px]">spawn</code>) so the manifest tells your dispatcher to fork ECS/K8s jobs vs
            running in-process — not secrets.
          </p>
          <input
            type="text"
            value={newConnectorName}
            onChange={(e) => setNewConnectorName(e.target.value)}
            placeholder="Label (e.g. AWS prod)"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          <textarea
            value={newConnectorMeta}
            onChange={(e) => setNewConnectorMeta(e.target.value)}
            placeholder='e.g. {"cloud":"aws"} or {"pipelineRunIsolation":"spawn","monitorCheckIsolation":"spawn"}'
            rows={2}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            type="button"
            disabled={creatingConnector || !newConnectorName.trim()}
            onClick={() => void addNamedConnector()}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creatingConnector ? "Generating…" : "Generate token"}
          </button>
        </div>

        {hasAccountToken ? (
          <p className="mt-4 text-[11px] text-slate-400 dark:text-slate-500">
            A legacy account-wide API token is still on your user record (not listed here). Prefer the tokens above; you
            can revoke the legacy token via the API or a future settings control if you no longer need it.
          </p>
        ) : null}
      </section>

      {token ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">New token — copy now</p>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950">
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
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Setup instructions</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Docker</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 mb-2">
            Use any issued token in <code className="text-[11px]">ELTPULSE_AGENT_TOKEN</code> (same variable name as the
            connector image).
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
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">.env template</p>
          <div className="relative mt-2">
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
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">How your gateway works</h2>
        <ul className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 list-inside list-disc">
          <li>
            Calls <code className="text-[11px]">GET /api/agent/manifest</code> with the gateway Bearer token for intervals
            and workloads
          </li>
          <li>Polls <code className="text-[11px]">GET /api/agent/runs?status=pending</code> at the manifest interval</li>
          <li>
            <code className="text-[11px]">GET /api/agent/connections</code> for secrets — same Bearer token per gateway
            process
          </li>
          <li>
            <code className="text-[11px]">POST /api/agent/heartbeat</code> so eltPulse can show liveness in this UI
          </li>
        </ul>
      </section>
        </>
      ) : null}

      <RelatedLinks links={[
        { href: "/runs", icon: Play, label: "Runs", desc: "Live telemetry and history for every pipeline execution" },
        { href: "/builder", icon: Layers, label: "Pipelines", desc: "Define source → destination connections" },
        { href: "/orchestration", icon: Waypoints, label: "Orchestration", desc: "Schedule sensors that trigger runs automatically" },
        { href: "/webhooks", icon: Webhook, label: "Webhooks", desc: "Fire notifications when runs reach a terminal state" },
      ]} />
    </div>
  );
}
