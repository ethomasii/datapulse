"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Cable, Plus, Trash2, ChevronDown, ChevronRight, Check, Shield } from "lucide-react";
import { ConnectionStoredSecretsForm } from "@/components/elt/connection-stored-secrets-form";
import { CopyEnvButton } from "@/components/elt/copy-env-button";
import { CREDENTIAL_HINTS } from "@/lib/elt/credential-hints";
import { getDestinationCredentials, getSourceCredentials } from "@/lib/elt/credentials-catalog";

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

// ── Connector lists ──────────────────────────────────────────────────────────

const SOURCE_CONNECTORS = [
  "rest_api", "github", "stripe", "shopify", "salesforce", "postgres", "mysql",
  "mongodb", "trino", "clickhouse", "mssql", "hubspot", "google_analytics", "slack",
  "notion", "airtable", "zendesk", "jira", "facebook_ads", "google_ads", "intercom",
  "mixpanel", "segment", "asana", "duckdb", "sqlite", "s3", "gcs", "azure_blob",
  "csv", "json", "parquet",
] as const;

const DESTINATION_CONNECTORS = [
  "snowflake", "bigquery", "redshift", "postgres", "duckdb", "motherduck",
  "databricks", "clickhouse", "mysql", "sqlite", "filesystem", "trino",
  "elasticsearch", "mssql", "druid", "pinot",
] as const;

// Common non-secret config keys per connector (label → key)
const CONNECTOR_CONFIG_HINTS: Record<string, { key: string; label: string; placeholder?: string }[]> = {
  postgres: [
    { key: "host", label: "Host", placeholder: "db.example.com" },
    { key: "port", label: "Port", placeholder: "5432" },
    { key: "database", label: "Database" },
    { key: "username", label: "Username" },
  ],
  mysql: [
    { key: "host", label: "Host" },
    { key: "port", label: "Port", placeholder: "3306" },
    { key: "database", label: "Database" },
    { key: "username", label: "Username" },
  ],
  mssql: [
    { key: "host", label: "Host" },
    { key: "port", label: "Port", placeholder: "1433" },
    { key: "database", label: "Database" },
    { key: "username", label: "Username" },
  ],
  snowflake: [
    { key: "account", label: "Account", placeholder: "xy12345.us-east-1" },
    { key: "database", label: "Database" },
    { key: "warehouse", label: "Warehouse" },
    { key: "role", label: "Role" },
    { key: "username", label: "Username" },
  ],
  bigquery: [
    { key: "project", label: "Project ID" },
    { key: "dataset", label: "Default dataset" },
    { key: "location", label: "Location", placeholder: "US" },
  ],
  redshift: [
    { key: "host", label: "Host" },
    { key: "port", label: "Port", placeholder: "5439" },
    { key: "database", label: "Database" },
    { key: "username", label: "Username" },
    { key: "schema", label: "Schema" },
  ],
  databricks: [
    { key: "server_hostname", label: "Server hostname" },
    { key: "http_path", label: "HTTP path" },
    { key: "catalog", label: "Catalog" },
    { key: "schema", label: "Schema" },
  ],
  clickhouse: [
    { key: "host", label: "Host" },
    { key: "port", label: "Port", placeholder: "9440" },
    { key: "database", label: "Database" },
    { key: "username", label: "Username" },
  ],
  duckdb: [
    { key: "database", label: "Database path", placeholder: "/data/warehouse.duckdb" },
  ],
  motherduck: [
    { key: "database", label: "Database", placeholder: "md:my_db" },
  ],
  s3: [
    { key: "bucket", label: "Bucket" },
    { key: "region", label: "Region", placeholder: "us-east-1" },
    { key: "prefix", label: "Prefix / path" },
  ],
  gcs: [
    { key: "bucket", label: "Bucket" },
    { key: "project", label: "Project ID" },
  ],
  azure_blob: [
    { key: "account_name", label: "Account name" },
    { key: "container", label: "Container" },
  ],
  github: [
    { key: "org", label: "Organization" },
    { key: "repo", label: "Repository (optional)" },
  ],
  rest_api: [
    { key: "base_url", label: "Base URL" },
  ],
  stripe: [
    { key: "account_id", label: "Account ID (optional)" },
  ],
  shopify: [
    { key: "shop", label: "Shop subdomain", placeholder: "my-store.myshopify.com" },
  ],
  salesforce: [
    { key: "domain", label: "Domain", placeholder: "login" },
  ],
  hubspot: [
    { key: "account_id", label: "Account ID" },
  ],
  google_analytics: [
    { key: "property_id", label: "Property ID" },
  ],
  mongodb: [
    { key: "host", label: "Host" },
    { key: "database", label: "Database" },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function connectorLabel(c: string) {
  const MAP: Record<string, string> = {
    rest_api: "REST API", s3: "Amazon S3", gcs: "Google Cloud Storage", azure_blob: "Azure Blob",
    mssql: "SQL Server", google_analytics: "Google Analytics", facebook_ads: "Facebook Ads",
    google_ads: "Google Ads", motherduck: "MotherDuck",
  };
  return MAP[c] ?? c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, " ");
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
  if (connectionType === "destination") {
    const d = getDestinationCredentials(key);
    if (d.length) return d.map((f) => ({ key: f.key, label: f.label, help: f.help }));
  } else {
    const s = getSourceCredentials(key);
    if (s.length) return s.map((f) => ({ key: f.key, label: f.label, help: f.help }));
  }
  const h = CREDENTIAL_HINTS[key];
  if (h) return h.map((x) => ({ key: x.key, label: x.label, help: x.help }));
  return [];
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
        eltPulse does not store passwords or API keys in connection JSON. Set these variables where this connection is
        used (local <code className="rounded bg-white/60 px-0.5 dark:bg-emerald-950/50">.env</code>, CI secrets, or your
        gateway host).
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
  const hints = CONNECTOR_CONFIG_HINTS[connector] ?? [];
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
  onDelete,
}: {
  conn: Connection;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [cfg, setCfg] = useState<Record<string, string>>(conn.config as Record<string, string>);
  const [secretsDraft, setSecretsDraft] = useState<Record<string, string>>({});
  const [clearSecrets, setClearSecrets] = useState(false);
  const [hasSecrets, setHasSecrets] = useState(Boolean(conn.hasStoredSecrets));

  const hints = CONNECTOR_CONFIG_HINTS[conn.connector] ?? [];

  useEffect(() => {
    setCfg(conn.config as Record<string, string>);
    setHasSecrets(Boolean(conn.hasStoredSecrets));
    setSecretsDraft({});
    setClearSecrets(false);
  }, [conn.id, conn.updatedAt, conn.config, conn.hasStoredSecrets]);

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
        </div>
        <span className="ml-auto shrink-0 text-xs text-slate-400">{fmt(conn.updatedAt)}</span>
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
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-4 dark:border-slate-800">
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
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
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

  const connectorList = type === "source" ? SOURCE_CONNECTORS : DESTINATION_CONNECTORS;

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
          <select
            value={connector}
            onChange={(e) => setConnector(e.target.value)}
            required
            className="mt-1 w-full rounded border border-sky-200 bg-white px-2 py-1.5 text-sm dark:border-sky-800 dark:bg-sky-950 dark:text-white"
          >
            <option value="">Select…</option>
            {connectorList.map((c) => (
              <option key={c} value={c}>
                {connectorLabel(c)}
              </option>
            ))}
          </select>
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [migrationPending, setMigrationPending] = useState(false);
  const [filter, setFilter] = useState<"all" | ConnectionType>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiFetch("/api/elt/connections");
      if (res.status === 401) {
        setConnections([]);
        setLoadError("You are not signed in, or your session expired. Sign in again to load connections.");
        return;
      }
      const text = await res.text();
      if (!text) {
        setConnections([]);
        return;
      }
      try {
        const data = JSON.parse(text);
        if (!res.ok) {
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    const res = await apiFetch(`/api/elt/connections/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setConnections((prev) => prev.filter((c) => c.id !== id));
  }

  function onCreated(c: Connection) {
    setConnections((prev) => [c, ...prev]);
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
            Define sources and destinations once, then reference them by name in any pipeline. Non-secret config only — passwords and tokens stay in your environment.
          </p>
        </div>
        <CreateConnectionForm onCreated={onCreated} />
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
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <Cable className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
            {connections.length === 0 ? "No connections yet" : `No ${filter} connections`}
          </p>
          {connections.length === 0 && (
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Create a source or destination connection to reuse it across pipelines.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((conn) => (
            <ConnectionRow key={conn.id} conn={conn} onDelete={remove} />
          ))}
        </ul>
      )}

      {/* Info callout */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">How connections work</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400 list-inside list-disc">
          <li>
            Set <code className="text-[11px]">source_connection</code> or{" "}
            <code className="text-[11px]">destination_connection</code> in a pipeline to use a named connection.
          </li>
          <li>eltPulse merges the saved config with your pipeline definition at run time.</li>
          <li>Secrets (passwords, API keys, service accounts) are never stored — use environment variables.</li>
          <li>Changing a connection here propagates to every pipeline that references it by name.</li>
        </ul>
      </div>
    </div>
  );
}
