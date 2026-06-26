"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { CatalogCredentialField } from "@/lib/elt/credentials-catalog";
import { CredentialFieldHelp } from "@/components/elt/credential-field-help";

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
  secretsStoredOnConnection?: boolean;
};

/** Renders `SOURCE_CREDENTIALS` / `DESTINATION_CREDENTIALS` field definitions. */
export function CatalogCredentialFields({ fields, values, onPatch, secretsStoredOnConnection = false }: Props) {
  const [replacingKeys, setReplacingKeys] = useState<Set<string>>(() => new Set());

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
              <CredentialFieldHelp help={f.help} />
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
              <CredentialFieldHelp help={f.help} />
            </label>
          );
        }

        if (f.type === "password") {
          const configuredOnConnection = secretsStoredOnConnection && !cur && !replacingKeys.has(f.key);
          return (
            <label key={f.key} className="block sm:col-span-2">
              {label}
              <span className="ml-1 font-mono text-[10px] text-slate-400">({f.key})</span>
              {configuredOnConnection ? (
                <div className="mt-1 space-y-2">
                  <div
                    className="flex items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50/90 px-3 py-2.5 dark:border-emerald-800 dark:bg-emerald-950/40"
                    aria-label={`${f.key} is configured on the linked connection`}
                  >
                    <span className="flex items-center gap-2 font-mono text-sm text-emerald-950 dark:text-emerald-100">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      {f.key} = ••••••••
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Saved
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplacingKeys((prev) => new Set(prev).add(f.key))}
                    className="text-[11px] font-medium text-sky-600 hover:underline dark:text-sky-400"
                  >
                    Replace token
                  </button>
                </div>
              ) : (
                <input
                  type="password"
                  value={cur}
                  autoComplete="off"
                  onChange={(e) => onPatch(f.key, e.target.value)}
                  placeholder={f.placeholder ?? "Paste token to save on connection"}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              )}
              <CredentialFieldHelp help={f.help} />
              {configuredOnConnection ? (
                <p className="mt-1 text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-300">
                  At run time the worker sets env var <code className="font-mono text-[10px]">{f.key}</code> from your
                  linked connection. The token value is never shown again after save — type in the field above only if
                  you need to replace it (save as connection afterward).
                </p>
              ) : cur ? (
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Save via <strong>Save as connection</strong> or the{" "}
                  <a href="/connections" className="font-medium text-sky-600 underline hover:no-underline dark:text-sky-400">
                    Connections
                  </a>{" "}
                  page so managed runs inject <code className="font-mono text-[10px]">{f.key}</code> automatically.
                </p>
              ) : (
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Managed runs read <code className="font-mono text-[10px]">{f.key}</code> from the linked source
                  connection at runtime — not from this pipeline JSON.
                </p>
              )}
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
            <CredentialFieldHelp help={f.help} />
          </label>
        );
      })}
    </div>
  );
}
