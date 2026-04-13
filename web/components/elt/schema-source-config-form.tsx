"use client";

import type { CatalogSourceConfigField } from "@/lib/elt/credentials-catalog";

function showIfMatches(showIf: Record<string, unknown>, value: Record<string, unknown>): boolean {
  return Object.entries(showIf).every(([k, v]) => value[k] === v);
}

function fieldVisible(f: CatalogSourceConfigField, value: Record<string, unknown>): boolean {
  if (!f.show_if) return true;
  return showIfMatches(f.show_if, value);
}

type Props = {
  sourceType: string;
  fields: CatalogSourceConfigField[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};

/**
 * Renders `SOURCE_CONFIGURATIONS[sourceType]` from the eltPulse connector catalog
 * (via credentials-catalog.json).
 */
export function SchemaSourceConfigForm({ sourceType, fields, value, onChange }: Props) {
  if (fields.length === 0) {
    return null;
  }

  function patch(key: string, v: unknown) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Source · {sourceType}
        </h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Fields sourced from the eltPulse connector catalog (
          <code className="text-[11px]">SOURCE_CONFIGURATIONS</code>). Credentials use the env panel — not stored in
          eltPulse.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          if (!fieldVisible(f, value)) return null;
          const baseLabel = (
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {f.label}
              {f.required ? <span className="text-red-500"> *</span> : null}
            </span>
          );

          if (f.type === "boolean") {
            const checked = Boolean(value[f.key]);
            return (
              <label key={f.key} className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => patch(f.key, e.target.checked)}
                />
                <span className="text-sm text-slate-800 dark:text-slate-200">{f.label}</span>
              </label>
            );
          }

          if (f.type === "select") {
            const cur = String(value[f.key] ?? f.default ?? "");
            return (
              <label key={f.key} className="block sm:col-span-2">
                {baseLabel}
                <select
                  value={cur}
                  onChange={(e) => patch(f.key, e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {f.help ? <p className="mt-1 text-xs text-slate-500">{f.help}</p> : null}
              </label>
            );
          }

          if (f.type === "multiselect") {
            const raw = value[f.key];
            const selected = Array.isArray(raw)
              ? raw.map((x: unknown) => String(x))
              : typeof raw === "string"
                ? raw
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                : (f.default as string[] | undefined)?.map(String) ?? [];
            return (
              <fieldset key={f.key} className="sm:col-span-2">
                <legend className="text-xs text-slate-600 dark:text-slate-400">{f.label}</legend>
                {f.help ? <p className="mt-1 text-xs text-slate-500">{f.help}</p> : null}
                <div className="mt-2 flex flex-wrap gap-3">
                  {(f.options ?? []).map((o) => {
                    const on = selected.includes(o.value);
                    return (
                      <label key={o.value} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            const next = on ? selected.filter((x) => x !== o.value) : [...selected, o.value];
                            patch(f.key, next);
                          }}
                        />
                        {o.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          }

          if (f.type === "textarea") {
            const raw = value[f.key];
            const str =
              typeof raw === "string"
                ? raw
                : raw !== undefined && raw !== null
                  ? JSON.stringify(raw, null, 2)
                  : "";
            return (
              <label key={f.key} className="block sm:col-span-2">
                {baseLabel}
                <textarea
                  value={str}
                  onChange={(e) => patch(f.key, e.target.value)}
                  rows={8}
                  placeholder={f.placeholder}
                  spellCheck={false}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
                {f.help ? <p className="mt-1 text-xs text-slate-500">{f.help}</p> : null}
              </label>
            );
          }

          const strVal =
            value[f.key] === undefined || value[f.key] === null ? "" : String(value[f.key]);
          return (
            <label key={f.key} className="block sm:col-span-2">
              {baseLabel}
              <input
                type="text"
                value={strVal}
                onChange={(e) => patch(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
              {f.help ? <p className="mt-1 text-xs text-slate-500">{f.help}</p> : null}
            </label>
          );
        })}
      </div>
    </div>
  );
}
