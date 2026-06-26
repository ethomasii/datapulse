"use client";

import { CatalogCredentialFields } from "@/components/elt/catalog-credential-fields";
import { getDestinationCredentials } from "@/lib/elt/credentials-catalog";
import { STARTER_WAREHOUSE_DEFAULT_DB } from "@/lib/elt/starter-warehouse";

type Props = {
  destinationType: string;
  sourceCfg: Record<string, unknown>;
  onSourceCfgChange: (next: Record<string, unknown>) => void;
  connectionValues: Record<string, string>;
  onConnectionPatch: (key: string, value: string) => void;
  linkedDestConnection?: { name: string; hasStoredSecrets: boolean } | null;
};

export function GuidedDestinationBlock({
  destinationType,
  sourceCfg,
  onSourceCfgChange,
  connectionValues,
  onConnectionPatch,
  linkedDestConnection = null,
}: Props) {
  const destCreds = getDestinationCredentials(destinationType);
  const isMotherduck = destinationType === "motherduck";
  const motherduckDb =
    connectionValues.MOTHERDUCK_DATABASE?.trim() || STARTER_WAREHOUSE_DEFAULT_DB;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">Load target</h3>
        {isMotherduck ? (
          <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
            Quick start creates a MotherDuck connection with database{" "}
            <code className="font-mono text-[11px]">{STARTER_WAREHOUSE_DEFAULT_DB}</code> (editable below as{" "}
            <code className="font-mono text-[11px]">MOTHERDUCK_DATABASE</code>). Tables land in a dlt schema — by
            default <code className="font-mono text-[11px]">{"github_{owner}_{repo}"}</code> unless you set
            you set dataset/schema override.
          </p>
        ) : (
          <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
            <code className="text-[11px]">schema_override</code> sets the target schema/dataset name.{" "}
            <code className="text-[11px]">destination_instance</code> selects a named connection profile.
          </p>
        )}
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
          ) : (
            <p className="sm:col-span-2 text-[11px] text-emerald-800/90 dark:text-emerald-200/80">
              Linked MotherDuck database:{" "}
              <code className="font-mono">{motherduckDb}</code> — change it under destination credentials below.
            </p>
          )}
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
