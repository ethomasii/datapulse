"use client";

import { CatalogCredentialFields } from "@/components/elt/catalog-credential-fields";
import { getDestinationCredentials } from "@/lib/elt/credentials-catalog";

type Props = {
  destinationType: string;
  sourceCfg: Record<string, unknown>;
  onSourceCfgChange: (next: Record<string, unknown>) => void;
  connectionValues: Record<string, string>;
  onConnectionPatch: (key: string, value: string) => void;
};

export function GuidedDestinationBlock({
  destinationType,
  sourceCfg,
  onSourceCfgChange,
  connectionValues,
  onConnectionPatch,
}: Props) {
  const destCreds = getDestinationCredentials(destinationType);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">Load target</h3>
        <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
          <code className="text-[11px]">schema_override</code> sets the target schema/dataset name.{" "}
          <code className="text-[11px]">destination_instance</code> selects a named connection profile.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
              className="mt-1 w-full rounded border border-emerald-200 bg-white px-2 py-1.5 font-mono text-sm dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
            />
          </label>
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
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Destination connection</h4>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Same fields as <code className="text-[11px]">DESTINATION_CREDENTIALS</code> (Snowflake, BigQuery, DuckDB path,
          etc.). Non-secret values can be saved; passwords / PEM / service-account JSON are not persisted.
        </p>
        <div className="mt-3">
          <CatalogCredentialFields fields={destCreds} values={connectionValues} onPatch={onConnectionPatch} />
        </div>
      </div>
    </div>
  );
}
