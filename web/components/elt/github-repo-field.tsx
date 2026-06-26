"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useGithubRepoDiscovery } from "@/components/elt/table-picker";

type Props = {
  value: string;
  onChange: (fullName: string) => void;
  sourceConnectionId?: string | null;
  inlineSecrets?: Record<string, string>;
};

const PLACEHOLDER_REPOS = new Set(["your-org/your-repo", "owner/repo"]);

function isPlaceholderRepo(value: string): boolean {
  return PLACEHOLDER_REPOS.has(value.trim().toLowerCase());
}

export function GithubRepoField({ value, onChange, sourceConnectionId, inlineSecrets }: Props) {
  const canDiscover = Boolean(sourceConnectionId || inlineSecrets?.GITHUB_TOKEN?.trim());
  const discovery = useGithubRepoDiscovery({
    connectionId: sourceConnectionId ?? null,
    secrets: sourceConnectionId ? undefined : inlineSecrets,
    enabled: canDiscover,
  });

  const showPlaceholderWarning = isPlaceholderRepo(value);

  const repoOptions = useMemo(() => {
    const items = discovery.items.filter((i) => !isPlaceholderRepo(i.id));
    const ids = new Set(items.map((i) => i.id));
    if (value.trim() && !ids.has(value.trim()) && !isPlaceholderRepo(value)) {
      return [{ id: value.trim(), name: value.trim() }, ...items];
    }
    return items;
  }, [discovery.items, value]);

  const canPickFromList = canDiscover && repoOptions.length > 0 && !discovery.loading && !discovery.error;
  const [manualEntry, setManualEntry] = useState(() => !canDiscover || showPlaceholderWarning);

  const showPicker = canPickFromList && !manualEntry;
  const showManualInput = !showPicker;

  return (
    <div className="space-y-2 sm:col-span-2">
      <label className="block">
        <span className="text-xs text-slate-600 dark:text-slate-400">
          Repository <span className="text-red-500">*</span>
        </span>
        {showPlaceholderWarning ? (
          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
            Still using the default placeholder — pick a real repository or enter{" "}
            <code className="font-mono">owner/repo</code>.
          </p>
        ) : null}
        {canDiscover && discovery.loading ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Loading repositories from GitHub…
          </p>
        ) : null}
        {canDiscover && discovery.error ? (
          <p className="mt-2 text-xs text-amber-600">{discovery.error}</p>
        ) : null}
        {showPicker ? (
          <select
            value={isPlaceholderRepo(value) ? "" : value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          >
            <option value="">Select a repository…</option>
            {repoOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        ) : null}
        {showManualInput ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value.trim())}
            placeholder="my-org/my-repo"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          />
        ) : null}
        {!canDiscover ? (
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Link a GitHub source connection with a stored PAT, or enter a token below, to list repositories.
          </p>
        ) : null}
        {canPickFromList ? (
          <button
            type="button"
            onClick={() => setManualEntry((v) => !v)}
            className="mt-1 text-[11px] font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            {manualEntry ? "Pick from list instead" : "Or enter owner/repo manually"}
          </button>
        ) : null}
      </label>
    </div>
  );
}
