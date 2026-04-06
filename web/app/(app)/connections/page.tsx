"use client";

import { useCallback, useEffect, useState } from "react";
import { Cable, Plus, Trash2, ChevronDown, ChevronRight, Check } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type ConnectionType = "source" | "destination";

type Connection = {
  id: string;
  name: string;
  connectionType: ConnectionType;
  connector: string;
  config: Record<string, string>;
  updatedAt: string;
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
  const [cfg, setCfg] = useState<Record<string, string>>(conn.config as Record<string, string>);

  const hints = CONNECTOR_CONFIG_HINTS[conn.connector] ?? [];

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/elt/connections/${conn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: cfg }),
      });
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
                Non-secret config values only. Passwords, tokens, and keys belong in environment variables — never stored here.
              </p>
              <ConfigFields connector={conn.connector} values={cfg} onChange={(k, v) => setCfg((p) => ({ ...p, [k]: v }))} />
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {saved ? <><Check className="h-4 w-4" /> Saved</> : saving ? "Saving…" : "Save changes"}
              </button>
            </>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No editable config fields for this connector. Credentials are managed via environment variables.
            </p>
          )}
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const connectorList = type === "source" ? SOURCE_CONNECTORS : DESTINATION_CONNECTORS;

  useEffect(() => {
    setConnector("");
    setCfg({});
  }, [type]);

  useEffect(() => {
    setCfg({});
  }, [connector]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !connector) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/elt/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), connectionType: type, connector, config: cfg }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create connection");
        return;
      }
      onCreated(data.connection as Connection);
      setName("");
      setConnector("");
      setCfg({});
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
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);
  const [filter, setFilter] = useState<"all" | ConnectionType>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/elt/connections");
      const text = await res.text();
      if (!text) { setConnections([]); return; }
      try {
        const data = JSON.parse(text);
        setConnections((data.connections as Connection[]) ?? []);
        if (data._migrationPending) setMigrationPending(true);
      } catch {
        setConnections([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    await fetch(`/api/elt/connections/${id}`, { method: "DELETE" });
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
          <li>DataPulse merges the saved config with your pipeline definition at run time.</li>
          <li>Secrets (passwords, API keys, service accounts) are never stored — use environment variables.</li>
          <li>Changing a connection here propagates to every pipeline that references it by name.</li>
        </ul>
      </div>
    </div>
  );
}
