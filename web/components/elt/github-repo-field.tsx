"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useGithubRepoDiscovery } from "@/components/elt/table-picker";

type Props = {
  value: string;
  onChange: (fullName: string) => void;
  sourceConnectionId?: string | null;
  inlineSecrets?: Record<string, string>;
};

const PLACEHOLDER_REPOS = new Set(["your-org/your-repo", "owner/repo"]);

export function GithubRepoField({ value, onChange, sourceConnectionId, inlineSecrets }: Props) {
  const canDiscover = Boolean(sourceConnectionId || inlineSecrets?.GITHUB_TOKEN?.trim());
  const discovery = useGithubRepoDiscovery({
    connectionId: sourceConnectionId ?? null,
    secrets: sourceConnectionId ? undefined : inlineSecrets,
    enabled: canDiscover,
  });

  const showPlaceholderWarning = PLACEHOLDER_REPOS.has(value.trim().toLowerCase());

  const options = useMemo(() => {
    const ids = new Set(discovery.items.map((i) => i.id));
    if (value.trim() && !ids.has(value.trim())) {
      return [{ id: value.trim(), name: value.trim() }, ...discovery.items];
    }
    return discovery.items;
  }, [discovery.items, value]);

  return (
    <div className="space-y-2 sm:col-span-2">
      <label className="block">
        <span className="text-xs text-slate-600 dark:text-slate-400">
          Repository <span className="text-red-500">*</span>
        </span>
        {showPlaceholderWarning ? (
          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
            Still using the default placeholder — pick a real repository below or enter{" "}
            <code className="font-mono">owner/repo</code>.
          </p>
        ) : null}
        {canDiscover ? (
          <div className="mt-2">
            {discovery.loading ? (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Loading repositories from GitHub…
              </p>
            ) : discovery.error ? (
              <p className="text-xs text-amber-600">{discovery.error}</p>
            ) : options.length > 0 ? (
              <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              >
                <option value="">Select a repository…</option>
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Link a GitHub source connection with a stored PAT, or enter a token below, to list repositories.
          </p>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="my-org/my-repo"
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
        />
      </label>
    </div>
  );
}
