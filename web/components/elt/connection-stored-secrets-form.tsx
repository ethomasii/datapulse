"use client";

import { useMemo } from "react";
import { getDestinationCredentials, getSourceCredentials } from "@/lib/elt/credentials-catalog";

type ConnectionType = "source" | "destination";

type Props = {
  connectionType: ConnectionType;
  connector: string;
  /** Whether ciphertext exists in DB (inputs always start empty for security). */
  hasStoredSecrets: boolean;
  /** Called with patch object: keys with non-empty values set; keys with empty string remove (on save). */
  draftSecrets: Record<string, string>;
  onDraftChange: (next: Record<string, string>) => void;
  clearRequested: boolean;
  onClearRequested: (v: boolean) => void;
};

export function ConnectionStoredSecretsForm({
  connectionType,
  connector,
  hasStoredSecrets,
  draftSecrets,
  onDraftChange,
  clearRequested,
  onClearRequested,
}: Props) {
  const fields = useMemo(() => {
    const c = connector.toLowerCase();
    return connectionType === "destination" ? getDestinationCredentials(c) : getSourceCredentials(c);
  }, [connectionType, connector]);

  if (fields.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-violet-200/90 bg-violet-50/60 p-3 dark:border-violet-900/50 dark:bg-violet-950/25">
      <p className="text-xs font-semibold text-violet-950 dark:text-violet-100">Stored secrets (eltPulse SaaS)</p>
      <p className="mt-1 text-[11px] leading-snug text-violet-900/90 dark:text-violet-100/90">
        Values are <strong className="font-medium">AES-256-GCM encrypted</strong> at rest (same key material as GitHub OAuth
        tokens). They are <strong className="font-medium">never</strong> returned to the browser after save — only your
        self-hosted <strong className="font-medium">agent</strong> (Bearer token) can fetch them to populate the runner
        environment. Leave blank to leave an existing value unchanged; save with empty fields only to remove individual
        keys.
      </p>
      {hasStoredSecrets ? (
        <p className="mt-2 text-[11px] font-medium text-violet-800 dark:text-violet-200">
          Encrypted secrets are on file for this connection.
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        {fields.map((f) => (
          <label key={f.key} className="block text-[11px]">
            <span className="font-medium text-violet-900 dark:text-violet-100">{f.label}</span>
            <span className="ml-1 font-mono text-[10px] text-violet-700 dark:text-violet-300">({f.key})</span>
            <input
              type="password"
              autoComplete="off"
              placeholder={hasStoredSecrets ? "•••••••• (enter new value to replace)" : "Optional"}
              value={draftSecrets[f.key] ?? ""}
              onChange={(e) => onDraftChange({ ...draftSecrets, [f.key]: e.target.value })}
              className="mt-1 w-full rounded border border-violet-200 bg-white px-2 py-1.5 font-mono text-sm dark:border-violet-800 dark:bg-slate-950 dark:text-white"
            />
            {f.help && !f.help.startsWith("http") ? (
              <span className="mt-0.5 block text-[10px] text-violet-800/80 dark:text-violet-300/80">{f.help}</span>
            ) : null}
          </label>
        ))}
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-violet-900 dark:text-violet-100">
        <input
          type="checkbox"
          checked={clearRequested}
          onChange={(e) => onClearRequested(e.target.checked)}
          className="rounded border-violet-400"
        />
        Clear all stored secrets for this connection
      </label>
    </div>
  );
}
