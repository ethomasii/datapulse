"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FolderGit2, Loader2, Plus, Search } from "lucide-react";

export type GithubRepoOption = {
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
};

type Props = {
  value: { owner: string; repo: string; branch: string } | null;
  onChange: (next: { owner: string; repo: string; branch: string; url: string }) => void;
  disabled?: boolean;
  className?: string;
};

export function GithubRepoPicker({ value, onChange, disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<GithubRepoOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!repos) return [];
    const q = search.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [repos, search]);

  const loadRepos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/github/repos", { credentials: "same-origin" });
      const data = (await res.json()) as { repos?: GithubRepoOption[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load repositories");
      setRepos(data.repos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load repositories");
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function openPicker() {
    if (disabled) return;
    setOpen(true);
    if (repos === null) await loadRepos();
  }

  function pick(r: GithubRepoOption) {
    const [owner, repo] = r.fullName.split("/");
    if (!owner || !repo) return;
    onChange({
      owner,
      repo,
      branch: r.defaultBranch || "main",
      url: r.url,
    });
    setOpen(false);
    setSearch("");
  }

  async function createRepo() {
    const name = newRepoName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/github/repos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, private: true }),
      });
      const data = (await res.json()) as {
        repo?: GithubRepoOption;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not create repository");
      if (data.repo) {
        setRepos((prev) => [data.repo!, ...(prev ?? [])]);
        pick(data.repo);
        setShowCreate(false);
        setNewRepoName("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create repository");
    } finally {
      setCreating(false);
    }
  }

  const label =
    value?.owner && value.repo ? `${value.owner}/${value.repo} @ ${value.branch || "main"}` : "Choose a repository…";

  return (
    <div className={className}>
      <div className="relative" ref={ref}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void openPicker()}
          className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:border-sky-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <FolderGit2 className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate font-mono text-xs sm:text-sm">{label}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>

        {open ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-2 dark:border-slate-800">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search repos…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : error && !repos?.length ? (
                <p className="p-3 text-xs text-red-600 dark:text-red-400">{error}</p>
              ) : filtered.length === 0 ? (
                <p className="p-3 text-xs text-slate-500">No repositories found.</p>
              ) : (
                filtered.map((r) => (
                  <button
                    key={r.fullName}
                    type="button"
                    onClick={() => pick(r)}
                    className="flex w-full flex-col items-start gap-0.5 border-b border-slate-50 px-3 py-2 text-left hover:bg-sky-50 dark:border-slate-800 dark:hover:bg-sky-950/30"
                  >
                    <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">{r.fullName}</span>
                    {r.description ? (
                      <span className="line-clamp-1 text-xs text-slate-500">{r.description}</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-slate-100 p-2 dark:border-slate-800">
              {showCreate ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    placeholder="new-repo-name"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={creating || !newRepoName.trim()}
                    onClick={() => void createRepo()}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/40"
                >
                  <Plus className="h-3.5 w-3.5" /> Create new repository on GitHub
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {error && repos?.length ? (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{error}</p>
      ) : null}
      <p className="mt-2 text-xs text-slate-500">
        Requires GitHub connected under{" "}
        <Link href="/integrations" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
          Integrations
        </Link>
        . Same picker as{" "}
        <Link href="/repos" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
          Repositories
        </Link>
        .
      </p>
    </div>
  );
}
