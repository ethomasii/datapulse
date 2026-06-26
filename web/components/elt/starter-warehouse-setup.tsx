"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Database, ExternalLink, Loader2 } from "lucide-react";
import { ConnectorIcon } from "@/components/marketing/connector-icon";
import { AppPage, AppPageHeader } from "@/components/layout/app-page";
import {
  MOTHERDUCK_GETTING_STARTED_URL,
  MOTHERDUCK_SIGNUP_URL,
  MOTHERDUCK_TOKEN_DOCS,
  MOTHERDUCK_TOKEN_DOCS_URL,
  STARTER_WAREHOUSE_DEFAULT_DB,
  motherduckDestinationConfig,
} from "@/lib/elt/starter-warehouse";

export function StarterWarehouseSetup() {
  const router = useRouter();
  const [database, setDatabase] = useState(STARTER_WAREHOUSE_DEFAULT_DB);
  const [token, setToken] = useState("");
  const [connectionName, setConnectionName] = useState("Starter warehouse (MotherDuck)");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const config = motherduckDestinationConfig(database);
      const testRes = await fetch("/api/elt/connections/test", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionType: "destination",
          connector: "motherduck",
          config,
          secrets: { MOTHERDUCK_TOKEN: token.trim() },
        }),
      });
      const testData = (await testRes.json()) as { ok?: boolean; message?: string };
      if (!testData.ok) {
        throw new Error(testData.message ?? "Could not connect to MotherDuck — check token and database name.");
      }

      const createRes = await fetch("/api/elt/connections", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: connectionName.trim() || "Starter warehouse (MotherDuck)",
          connectionType: "destination",
          connector: "motherduck",
          config,
          secrets: { MOTHERDUCK_TOKEN: token.trim() },
        }),
      });
      const createData = (await createRes.json()) as {
        connection?: { id: string };
        error?: string;
      };
      if (!createRes.ok || !createData.connection?.id) {
        throw new Error(createData.error ?? "Failed to save connection");
      }

      const defaultRes = await fetch("/api/elt/workspace-defaults", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultDestinationConnectionId: createData.connection.id }),
      });
      if (!defaultRes.ok) {
        const d = (await defaultRes.json()) as { error?: string };
        throw new Error(d.error ?? "Saved connection but could not set workspace default");
      }

      setConnectionId(createData.connection.id);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AppPage width="narrow">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold text-emerald-950 dark:text-emerald-100">
                Starter warehouse ready
              </h2>
              <p className="mt-1 text-sm text-emerald-900/90 dark:text-emerald-200/90">
                <span className="font-medium">{connectionName}</span> is your workspace default. Pipelines and
                transforms can land data in MotherDuck database{" "}
                <code className="rounded bg-white/60 px-1 font-mono text-xs dark:bg-emerald-950/50">
                  {database.trim() || STARTER_WAREHOUSE_DEFAULT_DB}
                </code>
                .
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/quick-start?source=github&destination=motherduck")}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  Run GitHub → warehouse quick start <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                <Link
                  href="/builder"
                  className="inline-flex items-center rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-white/50 dark:border-emerald-800 dark:text-emerald-100"
                >
                  Open pipeline builder
                </Link>
              </div>
              {connectionId ? (
                <p className="mt-3 font-mono text-[10px] text-emerald-800/70 dark:text-emerald-300/70">
                  connection {connectionId}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage width="narrow">
      <AppPageHeader
        title="Starter warehouse"
        description="No Snowflake or Postgres? Use MotherDuck — hosted DuckDB with a free tier. Takes about two minutes."
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900/50 dark:bg-sky-950/30">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
          <Database className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <ConnectorIcon slug="motherduck" name="MotherDuck" size={18} />
            MotherDuck (recommended)
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            SQL warehouse in the cloud — no file paths, no infra. Great for prototyping, demos, and small pipelines.
            When you outgrow it, point the same pipelines at Snowflake or Postgres.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <a
              href={MOTHERDUCK_SIGNUP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline dark:text-sky-300"
            >
              Sign up free <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
            <a
              href={MOTHERDUCK_GETTING_STARTED_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline dark:text-sky-300"
            >
              Getting started guide <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </div>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </p>
      ) : null}

      <form
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Connection name</span>
          <input
            value={connectionName}
            onChange={(e) => setConnectionName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Database name</span>
          <input
            required
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            placeholder={STARTER_WAREHOUSE_DEFAULT_DB}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <span className="mt-1 block text-xs text-slate-500">Created in MotherDuck if it does not exist yet.</span>
        </label>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">MotherDuck API token</span>
          <input
            required
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="md_…"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <span className="mt-1 block text-xs text-slate-500">
            {MOTHERDUCK_TOKEN_DOCS}{" "}
            <a
              href={MOTHERDUCK_TOKEN_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-sky-600 hover:underline dark:text-sky-400"
            >
              MotherDuck: create an access token
            </a>
          </span>
        </label>
        <button
          type="submit"
          disabled={busy || !token.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50 sm:w-auto"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Testing &amp; saving…
            </>
          ) : (
            <>
              Save as workspace warehouse <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-xs text-slate-500">
        Already have Snowflake, Postgres, or S3-backed DuckDB?{" "}
        <Link href="/connections" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
          Add a connection manually
        </Link>{" "}
        or skip to{" "}
        <Link href="/quick-start" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
          Quick start
        </Link>
        .
      </p>
    </AppPage>
  );
}
