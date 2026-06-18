"use client";

import type { NativeComponentField } from "@/lib/elt/native-components";

type Props = {
  fields: NativeComponentField[];
  values: Record<string, unknown>;
  readOnly?: boolean;
  onChange: (next: Record<string, unknown>) => void;
};

function fieldValue(values: Record<string, unknown>, key: string, defaultVal?: unknown): string {
  const v = values[key];
  if (v === undefined || v === null) {
    if (defaultVal !== undefined && defaultVal !== null) return String(defaultVal);
    return "";
  }
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function parseFieldValue(field: NativeComponentField, raw: string): unknown {
  if (field.type === "string_list") {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (field.type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (field.type === "boolean") return raw === "true" || raw === "1";
  return raw;
}

export function ComponentSchemaForm({ fields, values, readOnly = false, onChange }: Props) {
  if (!fields.length) return null;

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const id = `comp-field-${field.key}`;
        const val = fieldValue(values, field.key, field.default);

        if (field.type === "select") {
          return (
            <label key={field.key} className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.description ? (
                <span className="mt-0.5 block text-[11px] text-slate-500">{field.description}</span>
              ) : null}
              <select
                id={id}
                disabled={readOnly}
                value={val}
                onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
              >
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (field.type === "text") {
          return (
            <label key={field.key} className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.description ? (
                <span className="mt-0.5 block text-[11px] text-slate-500">{field.description}</span>
              ) : null}
              <textarea
                id={id}
                readOnly={readOnly}
                rows={3}
                value={val}
                placeholder={field.placeholder}
                onChange={(e) =>
                  onChange({ ...values, [field.key]: parseFieldValue(field, e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-950"
              />
            </label>
          );
        }

        return (
          <label key={field.key} className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {field.label}
              {field.required ? " *" : ""}
            </span>
            {field.description ? (
              <span className="mt-0.5 block text-[11px] text-slate-500">{field.description}</span>
            ) : null}
            <input
              id={id}
              type={field.type === "number" ? "number" : "text"}
              readOnly={readOnly}
              value={val}
              placeholder={field.placeholder ?? (field.type === "string_list" ? "col_a, col_b" : undefined)}
              onChange={(e) =>
                onChange({ ...values, [field.key]: parseFieldValue(field, e.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
            />
          </label>
        );
      })}
    </div>
  );
}
