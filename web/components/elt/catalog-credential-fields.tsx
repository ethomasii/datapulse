"use client";

import type { CatalogCredentialField } from "@/lib/elt/credentials-catalog";

function credentialShowIfMatches(showIf: Record<string, unknown>, values: Record<string, string>): boolean {
  return Object.entries(showIf).every(([k, expected]) => {
    const cur = values[k] ?? "";
    if (typeof expected === "boolean") {
      if (expected) return cur === "true" || cur === "1";
      return cur === "" || cur === "false" || cur === "0";
    }
    return cur === String(expected);
  });
}

function fieldVisible(f: CatalogCredentialField, values: Record<string, string>): boolean {
  if (!f.show_if) return true;
  return credentialShowIfMatches(f.show_if, values);
}

type Props = {
  fields: CatalogCredentialField[];
  values: Record<string, string>;
  onPatch: (key: string, value: string) => void;
};

/** Renders `SOURCE_CREDENTIALS` / `DESTINATION_CREDENTIALS` field definitions. */
export function CatalogCredentialFields({ fields, values, onPatch }: Props) {
  if (fields.length === 0) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        No credential form for this catalog id — use defaults in <code className="text-[11px]">.env</code>.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        if (!fieldVisible(f, values)) return null;
        const cur = values[f.key] ?? (typeof f.default === "string" ? f.default : "");
        const label = (
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {f.label}
            {f.required ? <span className="text-red-500"> *</span> : null}
          </span>
        );

        if (f.type === "select") {
          return (
            <label key={f.key} className="block sm:col-span-2">
              {label}
              <select
                value={cur}
                onChange={(e) => onPatch(f.key, e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
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

        if (f.type === "textarea") {
          return (
            <label key={f.key} className="block sm:col-span-2">
              {label}
              <textarea
                value={cur}
                onChange={(e) => onPatch(f.key, e.target.value)}
                rows={4}
                placeholder={f.placeholder}
                spellCheck={false}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              />
              {f.help ? <p className="mt-1 text-xs text-slate-500">{f.help}</p> : null}
            </label>
          );
        }

        if (f.type === "password") {
          return (
            <label key={f.key} className="block sm:col-span-2">
              {label}
              <input
                type="password"
                value={cur}
                autoComplete="off"
                onChange={(e) => onPatch(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              />
              {f.help ? <p className="mt-1 text-xs text-slate-500">{f.help}</p> : null}
              <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
                Not saved to eltPulse — use for local .env export only.
              </p>
            </label>
          );
        }

        return (
          <label key={f.key} className="block sm:col-span-2">
            {label}
            <input
              type="text"
              value={cur}
              onChange={(e) => onPatch(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            />
            {f.help ? <p className="mt-1 text-xs text-slate-500">{f.help}</p> : null}
          </label>
        );
      })}
    </div>
  );
}
