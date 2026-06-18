"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Cable, Layers, Play, Plus, Trash2, ChevronDown, ChevronRight, Check, Shield, Waypoints } from "lucide-react";
import { RelatedLinks } from "@/components/ui/related-links";
import { EmptyState } from "@/components/ui/empty-state";
import { ConnectionStoredSecretsForm } from "@/components/elt/connection-stored-secrets-form";
import { CopyEnvButton } from "@/components/elt/copy-env-button";
import { getDestinationCredentials, getSourceCredentials } from "@/lib/elt/credentials-catalog";
import {
  ALL_CONNECTORS,
  SOURCE_CONNECTOR_SLUGS,
  DESTINATION_CONNECTOR_SLUGS,
  getConnectorConfigFields,
  connectorLabel,
} from "@/lib/elt/connectors-registry";
import { ConnectorCombobox } from "@/components/elt/connector-combobox";
import { ComponentCatalogSettings } from "@/components/elt/component-catalog-settings";

function connectorsByCategory(connectionType: "source" | "destination"): { category: string; slugs: string[] }[] {
  const grouped = new Map<string, string[]>();
  for (const c of ALL_CONNECTORS) {
    if (!c.connectionTypes.includes(connectionType)) continue;
    const cat = c.category;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(c.slug);
  }
  return Array.from(grouped.entries()).map(([category, slugs]) => ({ category, slugs }));
}

// ── Types ────────────────────────────────────────────────────────────────────

type ConnectionType = "source" | "destination";

type Connection = {
  id: string;
  name: string;
  connectionType: ConnectionType;
  connector: string;
  config: Record<string, string>;
  updatedAt: string;
  /** Present when API returns public connection shape (ciphertext never sent to browser). */
  hasStoredSecrets?: boolean;
};

type PipelineUsage = { id: string; name: string };


// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}


const TYPE_COLOR: Record<ConnectionType, string> = {
  source: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/50",
  destination: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/50",
};

const apiFetch = (input: string, init?: RequestInit) =>
  fetch(input, { credentials: "same-origin", ...init });

type AuthHintRow = { key: string; label: string; help?: string };

function runnerAuthHints(connectionType: ConnectionType, connector: string): AuthHintRow[] {
  const key = connector.toLowerCase();
  const fields = connectionType === "destination"
    ? getDestinationCredentials(key)
    : getSourceCredentials(key);
  return fields.map((f) => ({ key: f.key, label: f.label, help: f.help }));
}

function ConnectorRunnerAuthBlock({
  connectionType,
  connector,
}: {
  connectionType: ConnectionType;
  connector: string;
}) {
  const rows = runnerAuthHints(connectionType, connector);
  if (rows.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Authenticate in your runtime</p>
        <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
          No preset env keys for this connector in the catalog yet. Set whatever your driver expects in the environment
          where pipelines run, or add a <code className="rounded bg-white px-0.5 font-mono text-[10px] dark:bg-slate-800">credential_profile</code>{" "}
          key in custom config for Python monitors.
        </p>
      </div>
    );
  }
  const template = Object.fromEntries(rows.map((r) => [r.key, ""]));
  return (
    <div className="mt-4 rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-100">Authenticate in your runtime</p>
      <p className="mt-1 text-[11px] leading-snug text-emerald-900/90 dark:text-emerald-100/90">
        Passwords and API keys are never stored in the public <code className="rounded bg-white/60 px-0.5 dark:bg-emerald-950/50">config</code>{" "}
        JSON — only in optional encrypted storage above. Your runner still reads these env var names. Either set values
        yourself (local <code className="rounded bg-white/60 px-0.5 dark:bg-emerald-950/50">.env</code>, CI secrets), or
        have a trusted self-hosted gateway call{" "}
        <code className="rounded bg-white/60 px-0.5 font-mono text-[10px] dark:bg-emerald-950/50">GET /api/agent/connections</code>{" "}
        with its Bearer token to receive decrypted secrets and export them into the process environment.
      </p>
      <ul className="mt-2 space-y-1.5 text-[11px] text-emerald-950 dark:text-emerald-100">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <code className="shrink-0 rounded bg-white/80 px-1 font-mono text-[10px] dark:bg-emerald-950/60">{r.key}</code>
            <span className="text-emerald-900 dark:text-emerald-200">{r.label}</span>
            {r.help && r.help.startsWith("http") ? (
              <a
                href={r.help}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-800 underline dark:text-emerald-300"
              >
                Link
              </a>
            ) : r.help ? (
              <span className="text-emerald-800/80 dark:text-emerald-300/80">{r.help}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <CopyEnvButton values={template} className="border-emerald-300 dark:border-emerald-700" />
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function ConfigFields({
  connector,
  values,
  onChange,
}: {
  connector: string;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const hints = getConnectorConfigFields(connector);
  if (hints.length === 0) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        No standard config fields defined for this connector. Add custom keys below if needed.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {hints.map(({ key, label, placeholder }) => (
        <label key={key} className="block">
          <span className="text-xs text-slate-700 dark:text-slate-300">{label}</span>
          <input
            value={values[key] ?? ""}
            onChange={(e) => onChange(key, e.target.value)}
            placeholder={placeholder}
            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>
      ))}
    </div>
  );
}

function ConnectionRow({
  conn,
  usedBy,
  onDelete,
  isWorkspaceDefault,
  onSetAsDefault,
}: {
  conn: Connection;
  usedBy: PipelineUsage[];
  onDelete: (id: string) => void;
  isWorkspaceDefault?: boolean;
  onSetAsDefault?: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [cfg, setCfg] = useState<Record<string, string>>(conn.config as Record<string, string>);
  const [secretsDraft, setSecretsDraft] = useState<Record<string, string>>({});
  const [clearSecrets, setClearSecrets] = useState(false);
  const [hasSecrets, setHasSecrets] = useState(Boolean(conn.hasStoredSecrets));

  const hints = getConnectorConfigFields(conn.connector);

  useEffect(() => {
    setCfg(conn.config as Record<string, string>);
    setHasSecrets(Boolean(conn.hasStoredSecrets));
    setSecretsDraft({});
    setClearSecrets(false);
  }, [conn.id, conn.updatedAt, conn.config, conn.hasStoredSecrets]);

  async function testConnection() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await apiFetch(`/api/elt/connections/${conn.id}/test`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      setTestMsg(data.message ?? (data.ok ? "OK" : "Failed"));
    } catch {
      setTestMsg("Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaveErr(null);
    try {
      const body: Record<string, unknown> = { config: cfg };
      if (clearSecrets) {
        body.secrets = null;
      } else if (Object.keys(secretsDraft).length > 0) {
        body.secrets = secretsDraft;
      }
      const res = await apiFetch(`/api/elt/connections/${conn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        setSaveErr("Session expired — sign in again.");
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveErr(typeof j.error === "string" ? j.error : "Save failed");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        connection?: { hasStoredSecrets?: boolean };
      };
      if (typeof data.connection?.hasStoredSecrets === "boolean") {
        setHasSecrets(data.connection.hasStoredSecrets);
      }
      setSecretsDraft({});
      setClearSecrets(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
          <span className="font-medium text-slate-900 dark:text-white">{conn.name}</span>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_COLOR[conn.connectionType]}`}
          >
            {conn.connectionType}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">{connectorLabel(conn.connector)}</span>
          {isWorkspaceDefault && conn.connectionType === "destination" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              Default lake
            </span>
          ) : null}
          {usedBy.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
              {usedBy.length} pipeline{usedBy.length !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">unused</span>
          )}
        </div>
        <span className="ml-auto shrink-0 text-xs text-slate-400">{fmt(conn.updatedAt)}</span>
        {usedBy.length > 0 ? (
          <span
            className="ml-3 shrink-0 cursor-not-allowed rounded p-1 text-slate-300 dark:text-slate-600"
            title={`In use by: ${usedBy.map((p) => p.name).join(", ")} — unlink from pipelines first`}
          >
            <Trash2 className="h-4 w-4" />
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(conn.id);
            }}
            className="ml-3 shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            title="Delete connection"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-4 dark:border-slate-800">
          {conn.connectionType === "destination" && onSetAsDefault ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSetAsDefault(isWorkspaceDefault ? null : conn.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  isWorkspaceDefault
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {isWorkspaceDefault ? "Clear workspace default" : "Set as workspace default lake"}
              </button>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Used when declarative pipelines specify <code className="font-mono">destination: &quot;@workspace&quot;</code>
              </span>
            </div>
          ) : null}
          {usedBy.length > 0 && (
            <div className="mb-4 rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2.5 dark:border-sky-900 dark:bg-sky-900/10">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Used by {usedBy.length} pipeline{usedBy.length !== 1 ? "s" : ""}</p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {usedBy.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/builder?pipeline=${encodeURIComponent(p.id)}`}
                      className="inline-flex items-center gap-1 rounded border border-sky-200 bg-white px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-sky-950/30"
                    >
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hints.length > 0 ? (
            <>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Non-secret config values only. Use the encrypted section below for secrets you want eltPulse to store
                for managed runners and the gateway.
              </p>
              <ConfigFields connector={conn.connector} values={cfg} onChange={(k, v) => setCfg((p) => ({ ...p, [k]: v }))} />
            </>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No standard non-secret fields for this connector. You can still store encrypted secrets below, or use
              environment variables only.
            </p>
          )}
          <ConnectionStoredSecretsForm
            connectionType={conn.connectionType}
            connector={conn.connector}
            hasStoredSecrets={hasSecrets}
            draftSecrets={secretsDraft}
            onDraftChange={setSecretsDraft}
            clearRequested={clearSecrets}
            onClearRequested={setClearSecrets}
          />
          <ConnectorRunnerAuthBlock connectionType={conn.connectionType} connector={conn.connector} />
          {saveErr ? (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">{saveErr}</p>
          ) : null}
          {testMsg ? (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{testMsg}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void testConnection()}
              disabled={testing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
            {saved ? (
              <>
                <Check className="h-4 w-4" /> Saved
              </>
            ) : saving ? (
              "Saving…"
            ) : (
              "Save changes"
            )}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function CreateConnectionForm({ onCreated }: { onCreated: (c: Connection) => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ConnectionType>("source");
  const [connector, setConnector] = useState("");
  const [name, setName] = useState("");
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [secretsDraft, setSecretsDraft] = useState<Record<string, string>>({});
  const [clearSecrets, setClearSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");


  useEffect(() => {
    setConnector("");
    setCfg({});
    setSecretsDraft({});
    setClearSecrets(false);
  }, [type]);

  useEffect(() => {
    setCfg({});
    setSecretsDraft({});
    setClearSecrets(false);
  }, [connector]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !connector) return;
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        connectionType: type,
        connector,
        config: cfg,
      };
      if (Object.keys(secretsDraft).some((k) => secretsDraft[k]?.trim())) {
        payload.secrets = secretsDraft;
      }
      const res = await apiFetch("/api/elt/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("You must be signed in to create connections.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Failed to create connection");
        return;
      }
      onCreated(data.connection as Connection);
      setName("");
      setConnector("");
      setCfg({});
      setSecretsDraft({});
      setClearSecrets(false);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
      >
        <Plus className="h-4 w-4" />
        New connection
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-sky-200 bg-sky-50/60 p-5 dark:border-sky-900/50 dark:bg-sky-950/20"
    >
      <h3 className="mb-4 text-sm font-semibold text-sky-900 dark:text-sky-100">New connection</h3>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs text-sky-800 dark:text-sky-300">Connection name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. prod-postgres, bigquery-warehouse"
            className="mt-1 w-full rounded border border-sky-200 bg-white px-2 py-1.5 font-mono text-sm dark:border-sky-800 dark:bg-sky-950 dark:text-white"
          />
          <p className="mt-1 text-[11px] text-sky-700/70 dark:text-sky-300/60">
            Pipelines reference this name to reuse the connection.
          </p>
        </label>

        <label className="block">
          <span className="text-xs text-sky-800 dark:text-sky-300">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ConnectionType)}
            className="mt-1 w-full rounded border border-sky-200 bg-white px-2 py-1.5 text-sm dark:border-sky-800 dark:bg-sky-950 dark:text-white"
          >
            <option value="source">Source</option>
            <option value="destination">Destination</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-sky-800 dark:text-sky-300">Connector</span>
          <div className="mt-1">
            <ConnectorCombobox
              options={connectorsByCategory(type).flatMap(({ category, slugs }) =>
                slugs.map((s) => ({ slug: s, label: connectorLabel(s), category }))
              )}
              value={connector}
              onChange={setConnector}
              placeholder="Search connectors…"
            />
          </div>
        </label>
      </div>

      {connector && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-sky-800/80 dark:text-sky-300/70">
            Non-secret config — passwords and tokens belong in environment variables.
          </p>
          <ConfigFields connector={connector} values={cfg} onChange={(k, v) => setCfg((p) => ({ ...p, [k]: v }))} />
          <ConnectionStoredSecretsForm
            connectionType={type}
            connector={connector}
            hasStoredSecrets={false}
            draftSecrets={secretsDraft}
            onDraftChange={setSecretsDraft}
            clearRequested={clearSecrets}
            onClearRequested={setClearSecrets}
          />
          <ConnectorRunnerAuthBlock connectionType={type} connector={connector} />
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={saving || !name.trim() || !connector}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create connection"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const { isSignedIn } = useUser();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pipelineUsage, setPipelineUsage] = useState<Record<string, PipelineUsage[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [migrationPending, setMigrationPending] = useState(false);
  const [filter, setFilter] = useState<"all" | ConnectionType>("all");
  const [defaultDestinationConnectionId, setDefaultDestinationConnectionId] = useState<string | null>(null);
  const [defaultDestinationName, setDefaultDestinationName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [connRes, pipRes, defaultsRes] = await Promise.all([
        apiFetch("/api/elt/connections"),
        apiFetch("/api/elt/pipelines"),
        apiFetch("/api/elt/workspace-defaults"),
      ]);
      if (connRes.status === 401) {
        setConnections([]);
        setLoadError("You are not signed in, or your session expired. Sign in again to load connections.");
        return;
      }
      const text = await connRes.text();
      if (!text) {
        setConnections([]);
        return;
      }
      try {
        const data = JSON.parse(text);
        if (!connRes.ok) {
          setConnections([]);
          setLoadError(typeof data.error === "string" ? data.error : "Could not load connections");
          return;
        }
        setConnections((data.connections as Connection[]) ?? []);
        if (data._migrationPending) setMigrationPending(true);
      } catch {
        setConnections([]);
        setLoadError("Unexpected response from server.");
      }
      // Build connection → pipeline usage map
      if (pipRes.ok) {
        try {
          const pipData = (await pipRes.json()) as {
            pipelines?: { id: string; name: string; sourceConnectionId?: string | null; destinationConnectionId?: string | null }[];
          };
          const usage: Record<string, PipelineUsage[]> = {};
          for (const p of pipData.pipelines ?? []) {
            for (const cid of [p.sourceConnectionId, p.destinationConnectionId]) {
              if (!cid) continue;
              if (!usage[cid]) usage[cid] = [];
              if (!usage[cid].some((x) => x.id === p.id)) usage[cid].push({ id: p.id, name: p.name });
            }
          }
          setPipelineUsage(usage);
        } catch {
          /* usage map is optional context */
        }
      }
      if (defaultsRes.ok) {
        try {
          const d = (await defaultsRes.json()) as {
            defaultDestinationConnectionId?: string | null;
            defaultDestinationName?: string | null;
          };
          setDefaultDestinationConnectionId(d.defaultDestinationConnectionId ?? null);
          setDefaultDestinationName(d.defaultDestinationName ?? null);
        } catch {
          /* optional */
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if ((pipelineUsage[id]?.length ?? 0) > 0) return;
    const res = await apiFetch(`/api/elt/connections/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setConnections((prev) => prev.filter((c) => c.id !== id));
    setPipelineUsage((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  function onCreated(c: Connection) {
    setConnections((prev) => [c, ...prev]);
  }

  async function setWorkspaceDefaultDestination(id: string | null) {
    const res = await apiFetch("/api/elt/workspace-defaults", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultDestinationConnectionId: id }),
    });
    if (!res.ok) return;
    const d = (await res.json()) as {
      defaultDestinationConnectionId?: string | null;
      defaultDestinationName?: string | null;
    };
    setDefaultDestinationConnectionId(d.defaultDestinationConnectionId ?? null);
    setDefaultDestinationName(d.defaultDestinationName ?? null);
  }

  const visible = connections.filter((c) => filter === "all" || c.connectionType === filter);
  const sourceCount = connections.filter((c) => c.connectionType === "source").length;
  const destCount = connections.filter((c) => c.connectionType === "destination").length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cable className="h-5 w-5 text-sky-600" aria-hidden />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Connections</h1>
          </div>
          {migrationPending && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              Database migration pending. Stop the dev server, run{" "}
              <code className="text-[11px]">npx prisma generate</code> then apply{" "}
              <code className="text-[11px]">prisma/add-connections.sql</code> to your database, and restart.
            </div>
          )}
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Define sources and destinations once, then attach them to pipelines from the builder (stored as foreign keys).
            Non-secret config only — passwords and tokens stay in your environment.
          </p>
        </div>
        <CreateConnectionForm onCreated={onCreated} />
      </div>

      {defaultDestinationName ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
            Workspace default lake: {defaultDestinationName}
          </p>
          <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-100/90">
            Declarative pipelines can use <code className="font-mono">destination: &quot;@workspace&quot;</code> to land
            data here — Snowflake, Postgres, DuckDB, MotherDuck, S3/Parquet, or any saved destination profile.
          </p>
        </div>
      ) : destCount > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">No workspace default lake yet</p>
          <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-100/90">
            Expand a destination connection and set it as the workspace default to streamline declarative pipelines.
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-4 dark:border-violet-900/40 dark:bg-violet-950/20">
        <ComponentCatalogSettings />
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/25">
        <div className="flex flex-wrap items-start gap-2">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1 text-xs leading-snug text-sky-950 dark:text-sky-100">
            <p className="font-semibold text-sky-900 dark:text-sky-50">Two layers of authentication</p>
            <p>
              <strong className="font-medium">1. Your eltPulse account</strong> — this page and the Connections API are
              only available when you are signed in. Each row is stored under your user id in the database (not public).
            </p>
            <p>
              <strong className="font-medium">2. Connectors (warehouses, clouds, SaaS)</strong> — secrets are never saved
              in connection JSON. Expand a connection to see recommended <strong className="font-medium">environment variables</strong>{" "}
              for your runner, or use a secret manager and reference names in your pipeline repo.
            </p>
            <p>
              {isSignedIn ? (
                <Link href="/account" className="font-medium text-sky-700 underline dark:text-sky-300">
                  Account &amp; settings
                </Link>
              ) : (
                <>
                  <Link href="/sign-in" className="font-medium text-sky-700 underline dark:text-sky-300">
                    Sign in
                  </Link>
                  {" · "}
                  <Link href="/account" className="font-medium text-sky-700 underline dark:text-sky-300">
                    Account &amp; settings
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {loadError}{" "}
          <Link href="/sign-in" className="font-semibold underline">
            Sign in
          </Link>
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {(
          [
            { label: "Total", value: connections.length, color: "text-slate-700 dark:text-slate-200" },
            { label: "Sources", value: sourceCount, color: "text-sky-700 dark:text-sky-300" },
            { label: "Destinations", value: destCount, color: "text-emerald-700 dark:text-emerald-300" },
          ] as const
        ).map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      {connections.length > 0 && (
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/50 w-fit">
          {(["all", "source", "destination"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                filter === f
                  ? "bg-white shadow-sm text-slate-900 dark:bg-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Cable}
          title={connections.length === 0 ? "No connections yet" : `No ${filter} connections`}
          description="Save warehouse and source credentials once — reuse them across every pipeline."
          action={{ href: "/quick-start", label: "Quick start" }}
          secondaryAction={{ href: "/builder", label: "Open builder" }}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((conn) => (
            <ConnectionRow
              key={conn.id}
              conn={conn}
              usedBy={pipelineUsage[conn.id] ?? []}
              onDelete={remove}
              isWorkspaceDefault={conn.id === defaultDestinationConnectionId}
              onSetAsDefault={setWorkspaceDefaultDestination}
            />
          ))}
        </ul>
      )}

      {/* Info callout */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">How connections work</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400 list-inside list-disc">
          <li>
            Pipelines can reference a saved profile via <code className="text-[11px]">sourceConnectionId</code> /{" "}
            <code className="text-[11px]">destinationConnectionId</code> (pick a saved row in the pipeline builder).
          </li>
          <li>eltPulse merges the saved config with your pipeline definition at run time.</li>
          <li>Secrets (passwords, API keys, service accounts) are never stored — use environment variables.</li>
          <li>Deleting a connection clears the link on pipelines that pointed at it (FK set null).</li>
        </ul>
      </div>

      <RelatedLinks links={[
        { href: "/builder", icon: Layers, label: "Pipelines", desc: "Pick saved connections in source and destination forms" },
        { href: "/runs", icon: Play, label: "Runs", desc: "View executions that used these credentials" },
        { href: "/gateway", icon: Waypoints, label: "Gateway & execution", desc: "Configure where pipelines run" },
      ]} />
    </div>
  );
}
