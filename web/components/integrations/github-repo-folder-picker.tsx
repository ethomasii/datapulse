"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Loader2, Sparkles } from "lucide-react";
import { defaultDbtRepoSubpath, ELTPULSE_REPO } from "@/lib/elt/eltpulse-repo-layout";

type RepoRef = { owner: string; repo: string; branch: string };

type DirEntry = { name: string; path: string; type: "dir" | "file" };

type Props = {
  repo: RepoRef | null;
  projectName: string;
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
};

export function GithubRepoFolderPicker({ repo, projectName, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState("");
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const defaultPath = useMemo(
    () => (projectName.trim() ? defaultDbtRepoSubpath(projectName.trim()) : `${ELTPULSE_REPO.dbtDir}/my_project`),
    [projectName]
  );

  const displayValue = value.trim() || defaultPath;

  const loadPath = useCallback(
    async (path: string) => {
      if (!repo) return;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          owner: repo.owner,
          repo: repo.repo,
          branch: repo.branch,
          path,
        });
        const res = await fetch(`/api/integrations/github/repos/contents?${qs}`, {
          credentials: "same-origin",
        });
        const data = (await res.json()) as {
          entries?: DirEntry[];
          error?: string;
          exists?: boolean;
        };
        if (!res.ok) throw new Error(data.error ?? "Could not list folder");
        setEntries((data.entries ?? []).filter((e) => e.type === "dir"));
        setBrowsePath(path);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not list folder");
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [repo]
  );

  const loadSuggestions = useCallback(async () => {
    if (!repo) {
      setSuggestions([]);
      return;
    }
    const out = new Set<string>();
    out.add(defaultPath);

    try {
      const qs = new URLSearchParams({
        owner: repo.owner,
        repo: repo.repo,
        branch: repo.branch,
        path: ELTPULSE_REPO.dbtDir,
      });
      const res = await fetch(`/api/integrations/github/repos/contents?${qs}`, {
        credentials: "same-origin",
      });
      const data = (await res.json()) as { entries?: DirEntry[]; exists?: boolean };
      if (res.ok && data.exists !== false && data.entries) {
        for (const e of data.entries.filter((x) => x.type === "dir")) {
          out.add(e.path);
        }
      }
    } catch {
      /* ignore */
    }

    setSuggestions(Array.from(out).slice(0, 8));
  }, [repo, defaultPath]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (repo) void loadSuggestions();
    else setSuggestions([]);
  }, [repo, loadSuggestions]);

  async function openBrowser() {
    if (disabled || !repo) return;
    setOpen(true);
    await loadPath(browsePath || ELTPULSE_REPO.dbtDir);
  }

  function selectPath(path: string) {
    onChange(path);
    setOpen(false);
  }

  const crumbs = browsePath ? browsePath.split("/").filter(Boolean) : [];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        Folder in repo
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={defaultPath}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white disabled:opacity-50"
          />
          <div className="relative shrink-0" ref={ref}>
            <button
              type="button"
              disabled={disabled || !repo}
              onClick={() => void openBrowser()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-sky-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Browse
            </button>

            {open && repo ? (
              <div className="absolute right-0 top-full z-50 mt-1 w-[min(20rem,90vw)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => void loadPath("")}
                      className="font-medium text-sky-600 hover:underline dark:text-sky-400"
                    >
                      repo root
                    </button>
                    {crumbs.map((c, i) => {
                      const segPath = crumbs.slice(0, i + 1).join("/");
                      return (
                        <span key={segPath} className="flex items-center gap-1 text-slate-400">
                          <ChevronRight className="h-3 w-3" />
                          <button
                            type="button"
                            onClick={() => void loadPath(segPath)}
                            className="font-medium text-sky-600 hover:underline dark:text-sky-400"
                          >
                            {c}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => selectPath(browsePath)}
                    className="mt-2 w-full rounded-lg bg-sky-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
                  >
                    Use {browsePath || "(repo root)"}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                    </div>
                  ) : error ? (
                    <p className="p-3 text-xs text-red-600 dark:text-red-400">{error}</p>
                  ) : entries.length === 0 ? (
                    <p className="p-3 text-xs text-slate-500">No subfolders here.</p>
                  ) : (
                    entries.map((e) => (
                      <button
                        key={e.path}
                        type="button"
                        onClick={() => void loadPath(e.path)}
                        className="flex w-full items-center gap-2 border-b border-slate-50 px-3 py-2 text-left text-sm hover:bg-sky-50 dark:border-slate-800 dark:hover:bg-sky-950/30"
                      >
                        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span className="font-mono text-xs">{e.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </label>

      {!value.trim() ? (
        <p className="text-xs text-slate-500">
          Defaults to <code className="font-mono text-[11px]">{displayValue}</code> when you create the project.
        </p>
      ) : null}

      {suggestions.length > 0 && repo ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Sparkles className="h-3 w-3" /> Suggested
          </span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => onChange(s)}
              className={
                (value.trim() || defaultPath) === s
                  ? "rounded-full bg-sky-100 px-2 py-0.5 font-mono text-[11px] text-sky-800 dark:bg-sky-950 dark:text-sky-200"
                  : "rounded-full border border-slate-200 px-2 py-0.5 font-mono text-[11px] text-slate-600 hover:border-sky-300 dark:border-slate-700 dark:text-slate-300"
              }
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
