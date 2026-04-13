"use client";

import { SchemaSourceConfigForm } from "@/components/elt/schema-source-config-form";
import { CatalogCredentialFields } from "@/components/elt/catalog-credential-fields";
import type { CatalogSourceConfigField } from "@/lib/elt/credentials-catalog";
import { getSourceCredentials } from "@/lib/elt/credentials-catalog";

type Props = {
  sourceType: string;
  schemaFields: CatalogSourceConfigField[];
  sourceCfg: Record<string, unknown>;
  onSourceCfgChange: (next: Record<string, unknown>) => void;
  connectionValues: Record<string, string>;
  onConnectionPatch: (key: string, value: string) => void;
  /** When the catalog has no `SOURCE_CONFIGURATIONS` entry, edit connector JSON here. */
  genericConnectorJson?: { value: string; onChange: (s: string) => void };
};

export function GuidedSourceBlock({
  sourceType,
  schemaFields,
  sourceCfg,
  onSourceCfgChange,
  connectionValues,
  onConnectionPatch,
  genericConnectorJson,
}: Props) {
  const sourceCreds = getSourceCredentials(sourceType);

  return (
    <div className="space-y-6">
      {genericConnectorJson ? (
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Connector (JSON)</span>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            No guided fields in the catalog for this source id — edit JSON. Load target lives under Destination.
          </p>
          <textarea
            value={genericConnectorJson.value}
            onChange={(e) => genericConnectorJson.onChange(e.target.value)}
            rows={12}
            spellCheck={false}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          />
        </label>
      ) : null}
      {schemaFields.length > 0 ? (
        <SchemaSourceConfigForm
          sourceType={sourceType}
          fields={schemaFields}
          value={sourceCfg}
          onChange={onSourceCfgChange}
        />
      ) : null}

      {sourceType === "github" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">GitHub advanced settings</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Configure how eltPulse syncs this repository. The access token is never stored — set it in your runner environment.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs text-slate-600 dark:text-slate-400">PAT env var name</span>
              <input
                value={String(sourceCfg.github_token_env ?? "GITHUB_TOKEN")}
                onChange={(e) =>
                  onSourceCfgChange({ ...sourceCfg, github_token_env: e.target.value || "GITHUB_TOKEN" })
                }
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-600 dark:text-slate-400">Items per page (1–100)</span>
              <input
                value={
                  typeof sourceCfg.items_per_page === "number" ? String(sourceCfg.items_per_page) : "100"
                }
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  onSourceCfgChange({
                    ...sourceCfg,
                    items_per_page: !Number.isNaN(n) && n > 0 ? Math.min(100, n) : 100,
                  });
                }}
                inputMode="numeric"
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-600 dark:text-slate-400">Max items (empty = none)</span>
              <input
                value={typeof sourceCfg.max_items === "number" ? String(sourceCfg.max_items) : ""}
                onChange={(e) => {
                  const t = e.target.value.trim();
                  const n = { ...sourceCfg };
                  if (t === "") {
                    delete n.max_items;
                  } else {
                    const m = parseInt(t, 10);
                    if (!Number.isNaN(m) && m >= 0) n.max_items = m;
                  }
                  onSourceCfgChange(n);
                }}
                inputMode="numeric"
                placeholder="unlimited"
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
          </div>
        </div>
      )}

      {sourceType === "rest_api" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">REST · incremental</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Simple-mode REST codegen only. Advanced mode uses JSON in the schema form above.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(sourceCfg.incremental_enabled)}
              onChange={(e) => {
                const n = { ...sourceCfg };
                if (e.target.checked) n.incremental_enabled = true;
                else {
                  delete n.incremental_enabled;
                  delete n.cursor_field;
                  delete n.cursor_initial_value;
                }
                onSourceCfgChange(n);
              }}
            />
            Incremental (cursor-based)
          </label>
          {Boolean(sourceCfg.incremental_enabled) && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                placeholder="cursor_field"
                value={String(sourceCfg.cursor_field ?? "")}
                onChange={(e) =>
                  onSourceCfgChange({ ...sourceCfg, cursor_field: e.target.value || undefined })
                }
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
              <input
                placeholder="initial value (optional)"
                value={String(sourceCfg.cursor_initial_value ?? "")}
                onChange={(e) =>
                  onSourceCfgChange({ ...sourceCfg, cursor_initial_value: e.target.value || undefined })
                }
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
          )}
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Source connection</h4>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Same fields as <code className="text-[11px]">SOURCE_CREDENTIALS</code> in the eltPulse connector catalog. Non-secret
          values can be saved with the pipeline; passwords and large secrets are not persisted.
        </p>
        <div className="mt-3">
          <CatalogCredentialFields fields={sourceCreds} values={connectionValues} onPatch={onConnectionPatch} />
        </div>
      </div>
    </div>
  );
}
