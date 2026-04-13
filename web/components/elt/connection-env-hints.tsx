"use client";

import { useCallback, useState } from "react";
import {
  getDestinationCredentials,
  getSourceCredentials,
  type CatalogCredentialField,
} from "@/lib/elt/credentials-catalog";

function FieldList({ title, fields }: { title: string; fields: CatalogCredentialField[] }) {
  if (fields.length === 0) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        No credential schema for this connector. Check the eltPulse connector docs for required environment variable names.
      </p>
    );
  }
  return (
    <ul className="mt-2 space-y-2 text-slate-600 dark:text-slate-300">
      {fields.map((c) => (
        <li key={c.key}>
          <code className="rounded bg-white px-1 text-xs dark:bg-slate-800">{c.key}</code>
          <span> — {c.label}</span>
          {c.type === "password" ? (
            <span className="ml-1 text-xs text-amber-700 dark:text-amber-300">(secret — set in runner only)</span>
          ) : null}
          {c.help ? <div className="text-xs text-slate-500 dark:text-slate-400">{c.help}</div> : null}
        </li>
      ))}
    </ul>
  );
}

function buildDotEnvTemplate(sourceType: string, destinationType: string): string {
  const lines: string[] = [
    "# Paste into .env where you run the eltPulse runner",
    "",
  ];
  for (const f of getSourceCredentials(sourceType)) {
    lines.push(`${f.key}=`);
  }
  for (const f of getDestinationCredentials(destinationType)) {
    lines.push(`${f.key}=`);
  }
  return lines.join("\n");
}

/**
 * Source + destination credential definitions from `credentials_config.py`
 * (`SOURCE_CREDENTIALS` / `DESTINATION_CREDENTIALS`), same as the upstream FastAPI UI.
 */
export function ConnectionEnvHints({
  sourceType,
  destinationType,
  className = "",
}: {
  sourceType: string;
  destinationType: string;
  className?: string;
}) {
  const src = getSourceCredentials(sourceType);
  const dest = getDestinationCredentials(destinationType);
  const [copied, setCopied] = useState(false);

  const copyTemplate = useCallback(async () => {
    const text = buildDotEnvTemplate(sourceType, destinationType);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [sourceType, destinationType]);

  return (
    <div className={`space-y-4 text-sm ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copyTemplate()}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {copied ? "Copied" : "Copy .env template"}
        </button>
        <span className="text-xs text-slate-500">Empty values — fill locally</span>
      </div>
      <div>
        <h4 className="font-semibold text-slate-900 dark:text-white">Source · {sourceType}</h4>
        <FieldList title="" fields={src} />
      </div>
      <div>
        <h4 className="font-semibold text-slate-900 dark:text-white">Destination · {destinationType}</h4>
        <FieldList title="" fields={dest} />
      </div>
    </div>
  );
}
