"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { CatalogCredentialFields } from "@/components/elt/catalog-credential-fields";
import { getDestinationCredentials } from "@/lib/elt/credentials-catalog";
import {
  connectionConfigToFormValues,
  formValuesToConnectionConfig,
} from "@/lib/elt/credential-payload";
import { STARTER_WAREHOUSE_DEFAULT_DB } from "@/lib/elt/starter-warehouse";

type LinkedDestConnection = {
  id: string;
  name: string;
  connector: string;
  config: Record<string, string>;
  hasStoredSecrets: boolean;
};

type Props = {
  destinationType: string;
  sourceCfg: Record<string, unknown>;
  onSourceCfgChange: (next: Record<string, unknown>) => void;
  connectionValues: Record<string, string>;
  onConnectionPatch: (key: string, value: string) => void;
  linkedDestConnection?: LinkedDestConnection | null;
  onLinkedConnectionUpdated?: (config: Record<string, string>) => void;
};

export function GuidedDestinationBlock({
  destinationType,
  sourceCfg,
  onSourceCfgChange,
  connectionValues,
  onConnectionPatch,
  linkedDestConnection = null,
  onLinkedConnectionUpdated,
}: Props) {
  const destCreds = getDestinationCredentials(destinationType);
  const isMotherduck = destinationType === "motherduck";
  const motherduckDb =
    connectionValues.MOTHERDUCK_DATABASE?.trim() || STARTER_WAREHOUSE_DEFAULT_DB;

  const savedMotherduckDb = useMemo(() => {
    if (!linkedDestConnection || !isMotherduck) return null;
    const mapped = connectionConfigToFormValues(
      linkedDestConnection.connector,
      linkedDestConnection.config
    );
    return mapped.MOTHERDUCK_DATABASE?.trim() || STARTER_WAREHOUSE_DEFAULT_DB;
  }, [isMotherduck, linkedDestConnection]);

  const motherduckDbDirty =
    isMotherduck && savedMotherduckDb != null && motherduckDb !== savedMotherduckDb;

  const [savingDb, setSavingDb] = useState(false);
  const [saveDbError, setSaveDbError] = useState("");
  const [saveDbOk, setSaveDbOk] = useState(false);

  async function saveMotherduckDatabaseToConnection() {
    if (!linkedDestConnection || !isMotherduck) return;
    setSavingDb(true);
    setSaveDbError("");
    setSaveDbOk(false);
    const patch = formValuesToConnectionConfig(linkedDestConnection.connector, connectionValues);
    const config = { ...linkedDestConnection.config, ...patch };
    delete config.MOTHERDUCK_DATABASE;
    try {
      const res = await fetch(`/api/elt/connections/${linkedDestConnection.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = (await res.json()) as { error?: string; connection?: { config?: Record<string, unknown> } };
      if (!res.ok) {
        setSaveDbError(data.error ?? "Could not update connection");
        return;
      }
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.connection?.config ?? config)) {
        if (v != null) flat[k] = String(v);
      }
      onLinkedConnectionUpdated?.(flat);
      setSaveDbOk(true);
      setTimeout(() => setSaveDbOk(false), 2500);
    } catch (e) {
      setSaveDbError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingDb(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">Load target</h3>
        {isMotherduck ? (
          <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
            MotherDuck has two levels: a <strong>database</strong> (catalog) and a <strong>schema</strong> where dlt
            creates tables. Default schema is{" "}
            <code className="font-mono text-[11px]">{"github_{owner}_{repo}"}</code> unless you override it below.
          </p>
        ) : (
          <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
            <code className="text-[11px]">schema_override</code> sets the target schema/dataset name.{" "}
            <code className="text-[11px]">destination_instance</code> selects a named connection profile.
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {isMotherduck ? (
            <label className="block sm:col-span-2">
              <span className="text-xs text-emerald-900 dark:text-emerald-300">MotherDuck database</span>
              <input
                value={motherduckDb}
                onChange={(e) => onConnectionPatch("MOTHERDUCK_DATABASE", e.target.value)}
                placeholder={STARTER_WAREHOUSE_DEFAULT_DB}
                className="mt-1 w-full rounded border border-emerald-200 bg-white px-2 py-1.5 font-mono text-sm dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
              />
              <span className="mt-1 block text-[11px] text-emerald-800/90 dark:text-emerald-200/80">
                Where dlt loads tables (often <code className="font-mono">my_db</code> from quick start). Preview and
                column lookup use this catalog — not the eltPulse app name.
              </span>
              {linkedDestConnection ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {motherduckDbDirty ? (
                    <button
                      type="button"
                      disabled={savingDb || !motherduckDb.trim()}
                      onClick={() => void saveMotherduckDatabaseToConnection()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {savingDb ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
                      Save database to {linkedDestConnection.name}
                    </button>
                  ) : saveDbOk ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
                      <Check className="h-3.5 w-3.5" aria-hidden /> Saved on connection
                    </span>
                  ) : (
                    <span className="text-[11px] text-emerald-800/80 dark:text-emerald-200/70">
                      Saved on connection{" "}
                      <strong>{linkedDestConnection.name}</strong>
                      {savedMotherduckDb ? (
                        <>
                          {" "}
                          as <code className="font-mono">{savedMotherduckDb}</code>
                        </>
                      ) : null}
                    </span>
                  )}
                  <Link
                    href="/connections"
                    className="text-[11px] font-medium text-sky-700 underline hover:no-underline dark:text-sky-300"
                  >
                    Edit on Connections
                  </Link>
                </div>
              ) : (
                <span className="mt-1 block text-[11px] text-emerald-800/80 dark:text-emerald-200/70">
                  Link or save a connection above to persist this database for runs and preview.
                </span>
              )}
              {saveDbError ? (
                <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">{saveDbError}</p>
              ) : null}
            </label>
          ) : null}
          <label className="block sm:col-span-2">
            <span className="text-xs text-emerald-900 dark:text-emerald-300">Dataset / schema name (optional)</span>
            <input
              value={typeof sourceCfg.schema_override === "string" ? sourceCfg.schema_override : ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                const n = { ...sourceCfg };
                if (v) n.schema_override = v;
                else delete n.schema_override;
                onSourceCfgChange(n);
              }}
              placeholder={isMotherduck ? "e.g. github_myorg_myrepo (auto if empty)" : undefined}
              className="mt-1 w-full rounded border border-emerald-200 bg-white px-2 py-1.5 font-mono text-sm dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
            />
          </label>
          {!isMotherduck ? (
            <label className="block sm:col-span-2">
              <span className="text-xs text-emerald-900 dark:text-emerald-300">
                Named destination instance (optional)
              </span>
              <input
                value={typeof sourceCfg.destination_instance === "string" ? sourceCfg.destination_instance : ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  const n = { ...sourceCfg };
                  if (v) n.destination_instance = v;
                  else delete n.destination_instance;
                  onSourceCfgChange(n);
                }}
                className="mt-1 w-full rounded border border-emerald-200 bg-white px-2 py-1.5 font-mono text-sm dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
              />
            </label>
          ) : null}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Destination connection</h4>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Tokens and passwords are encrypted on the linked connection and are never shown again after save. Managed runs
          read them from the connection you select above.
        </p>
        {linkedDestConnection?.hasStoredSecrets ? (
          <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-[11px] text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
            Encrypted credentials are stored on connection{" "}
            <strong>{linkedDestConnection.name}</strong>. Leave token fields blank unless you want to replace them.
          </p>
        ) : linkedDestConnection ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            Connection <strong>{linkedDestConnection.name}</strong> has no stored secrets yet — add a token on the{" "}
            <a href="/connections" className="font-medium underline hover:no-underline">
              Connections
            </a>{" "}
            page or enter one below.
          </p>
        ) : null}
        <div className="mt-3">
          <CatalogCredentialFields
            fields={destCreds}
            values={connectionValues}
            onPatch={onConnectionPatch}
            secretsStoredOnConnection={Boolean(linkedDestConnection?.hasStoredSecrets)}
          />
        </div>
      </div>
    </div>
  );
}
