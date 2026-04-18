"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronDown,
  Globe,
  Loader2,
  Lock,
  Plug,
  Search,
} from "lucide-react";
import type { GithubConnectionSummary } from "@/lib/db/github-connection-query";
import { parseGithubRepositoryUrl } from "@/lib/integrations/parse-github-repo-url";

type PipelineRow = {
  id: string;
  name: string;
  sourceType: string;
  destinationType: string;
  enabled: boolean;
  updatedAt: string;
};

type RepoOption = {
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
};

type Props = {
  githubLogin: string | null;
  initialConnection: GithubConnectionSummary | null;
  githubTableMissing: boolean;
  showCustomerGithubOauth: boolean;
};

function defaultRepoUrl(row: GithubConnectionSummary | null): string {
  if (!row?.defaultRepoOwner || !row.defaultRepoName) return "";
  return `https://github.com/${row.defaultRepoOwner}/${row.defaultRepoName}`;
}

export function RepositoriesClient({
  githubLogin,
  initialConnection,
  githubTableMissing,
  showCustomerGithubOauth,
}: Props) {
  const [owner, setOwner] = useState(initialConnection?.defaultRepoOwner ?? "");
  const [repoName, setRepoName] = useState(initialConnection?.defaultRepoName ?? "");
  const [branch, setBranch] = useState(initialConnection?.defaultBranch ?? "main");
  const [repositoryUrl, setRepositoryUrl] = useState(() => defaultRepoUrl(initialConnection));

  const [showPicker, setShowPicker] = useState(false);
  const [repos, setRepos] = useState<RepoOption[] | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [repoError, setRepoError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [pipelines, setPipelines] = useState<PipelineRow[] | null>(null);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushingId, setPushingId] = useState<string | null>(null);

  useEffect(() => {
    setOwner(initialConnection?.defaultRepoOwner ?? "");
    setRepoName(initialConnection?.defaultRepoName ?? "");
    setBranch(initialConnection?.defaultBranch ?? "main");
    setRepositoryUrl(defaultRepoUrl(initialConnection));
  }, [initialConnection?.defaultRepoOwner, initialConnection?.defaultRepoName, initialConnection?.defaultBranch]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    if (showPicker) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  const loadPipelines = useCallback(async () => {
    setLoadingPipelines(true);
    try {
      const res = await fetch("/api/elt/pipelines");
      const json = (await res.json()) as { pipelines?: PipelineRow[] };
      if (!res.ok) throw new Error("Could not load pipelines");
      setPipelines(json.pipelines ?? []);
    } catch {
      setPipelines([]);
      setBanner({ kind: "err", text: "Could not load pipelines." });
    } finally {
      setLoadingPipelines(false);
    }
  }, []);

  useEffect(() => {
    void loadPipelines();
  }, [loadPipelines]);

  const persistRepoSettings = useCallback(
    async (o: string, n: string, b: string, opts?: { quiet?: boolean }): Promise<boolean> => {
      const oo = o.trim();
      const nn = n.trim();
      const bb = (b.trim() || "main") || "main";
      if (!opts?.quiet) setSaving(true);
      if (!opts?.quiet) setBanner(null);
      try {
        const res = await fetch("/api/integrations/github", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defaultRepoOwner: oo || null,
            defaultRepoName: nn || null,
            defaultBranch: bb || null,
          }),
        });
        const json = (await res.json()) as { error?: unknown };
        if (!res.ok) {
          const msg = typeof json.error === "string" ? json.error : "Save failed";
          throw new Error(msg);
        }
        if (!opts?.quiet) {
          setBanner({ kind: "ok", text: "Saved default repository and branch." });
        }
        return true;
      } catch (e) {
        setBanner({ kind: "err", text: e instanceof Error ? e.message : "Save failed" });
        return false;
      } finally {
        if (!opts?.quiet) setSaving(false);
      }
    },
    []
  );

  async function handleOpenPicker() {
    setShowPicker(true);
    setRepoError(null);
    if (repos) return;
    setLoadingRepos(true);
    try {
      const res = await fetch("/api/integrations/github/repos");
      const json = (await res.json()) as { repos?: RepoOption[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not list repositories");
      setRepos(json.repos ?? []);
    } catch (e) {
      setRepos([]);
      setRepoError(e instanceof Error ? e.message : "Could not list repositories");
    } finally {
      setLoadingRepos(false);
    }
  }

  async function pickRepo(r: RepoOption) {
    const [o, n] = r.fullName.split("/");
    if (!o || !n) return;
    const br = r.defaultBranch || "main";
    setOwner(o);
    setRepoName(n);
    setBranch(br);
    setRepositoryUrl(r.url);
    setShowPicker(false);
    setRepoSearch("");
    const ok = await persistRepoSettings(o, n, br, { quiet: true });
    if (ok) setBanner({ kind: "ok", text: `Using ${r.fullName} @ ${br} (saved).` });
  }

  async function applyPastedUrl() {
    setBanner(null);
    const parsed = parseGithubRepositoryUrl(repositoryUrl);
    if (!parsed) {
      setBanner({
        kind: "err",
        text: "Could not read that URL. Try https://github.com/org/repo or git@github.com:org/repo.git",
      });
      return;
    }
    const branchToUse = parsed.branch ?? (branch.trim() || "main");
    setOwner(parsed.owner);
    setRepoName(parsed.repo);
    setBranch(branchToUse);
    const url = `https://github.com/${parsed.owner}/${parsed.repo}`;
    setRepositoryUrl(parsed.branch ? `${url}/tree/${encodeURIComponent(parsed.branch)}` : url);
    const ok = await persistRepoSettings(parsed.owner, parsed.repo, branchToUse, { quiet: true });
    if (ok) {
      setBanner({
        kind: "ok",
        text: `Using ${parsed.owner}/${parsed.repo} @ ${branchToUse} (saved).`,
      });
    }
  }

  async function saveManualAdvanced() {
    setSaving(true);
    setBanner(null);
    const ok = await persistRepoSettings(owner, repoName, branch, { quiet: true });
    if (ok) {
      if (owner.trim() && repoName.trim()) {
        setRepositoryUrl(`https://github.com/${owner.trim()}/${repoName.trim()}`);
      }
      setBanner({ kind: "ok", text: "Saved default repository and branch." });
    }
    setSaving(false);
  }

  async function pullDeclarations() {
    setPulling(true);
    setBanner(null);
    try {
      const res = await fetch("/api/integrations/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pull_declarations" }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        applied?: string[];
        errors?: { path: string; message: string }[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Pull failed");
      const n = json.applied?.length ?? 0;
      const errN = json.errors?.length ?? 0;
      setBanner({
        kind: errN ? "err" : "ok",
        text:
          `Imported ${n} pipeline(s) from eltpulse/pipelines.` +
          (errN ? ` ${errN} file(s) skipped (see network response for paths).` : ""),
      });
      await loadPipelines();
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Pull failed" });
    } finally {
      setPulling(false);
    }
  }

  async function pushPipeline(id: string) {
    setPushingId(id);
    setBanner(null);
    try {
      const res = await fetch("/api/integrations/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push_pipeline", pipelineId: id }),
      });
      const json = (await res.json()) as { ok?: boolean; path?: string; htmlUrl?: string | null; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Push failed");
      const urlNote = json.htmlUrl ? ` Open: ${json.htmlUrl}` : "";
      setBanner({ kind: "ok", text: `Pushed ${json.path ?? "file"}.${urlNote}` });
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Push failed" });
    } finally {
      setPushingId(null);
    }
  }

  const filteredRepos = (repos ?? []).filter((r) =>
    !repoSearch.trim() ? true : r.fullName.toLowerCase().includes(repoSearch.trim().toLowerCase())
  );

  const canSync = Boolean(githubLogin && owner.trim() && repoName.trim() && branch.trim());

  if (githubTableMissing) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">GitHub connection storage is not in this database.</p>
        <p className="mt-2">
          From <code className="rounded bg-white/80 px-1 text-xs dark:bg-slate-900">web/</code>, run{" "}
          <code className="rounded bg-white/80 px-1 text-xs dark:bg-slate-900">npm run db:push</code> with{" "}
          <code className="rounded bg-white/80 px-1 text-xs dark:bg-slate-900">DATABASE_URL</code> set.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {banner && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 text-sm ${
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          }`}
        >
          {banner.text}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Git connection</h2>
        {!githubLogin ? (
          <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>
              Connect your GitHub account (optional BYO) to read and write{" "}
              <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">eltpulse/pipelines/*.yaml</code> in a
              repository you choose.
            </p>
            {showCustomerGithubOauth ? (
              <Link
                href="/api/integrations/github/start"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                <Plug className="h-4 w-4" aria-hidden />
                Connect GitHub
              </Link>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/50">
                Customer GitHub OAuth is disabled on this deployment (
                <code className="text-xs">CUSTOMER_GITHUB_OAUTH_ENABLED</code>). The default product uses managed repos;
                enable BYO OAuth for this flow, or use the API / CI to apply declarations.
              </p>
            )}
            <p>
              <Link href="/integrations" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                Integrations
              </Link>{" "}
              ·{" "}
              <Link href="/docs/repositories" className="inline-flex items-center gap-1 font-medium text-sky-600 hover:underline dark:text-sky-400">
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                Repository layout
              </Link>
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Connected as <span className="font-semibold text-slate-900 dark:text-white">@{githubLogin}</span>. Paste a
            GitHub repo URL or use <strong className="font-medium text-slate-800 dark:text-slate-200">Browse repositories</strong>{" "}
            to fill it in. We sync{" "}
            <code className="text-xs">eltpulse/pipelines/&lt;name&gt;.yaml</code> on the branch you set.
          </p>
        )}
      </section>

      {githubLogin ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Default repository</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              One URL field plus a searchable repo browser (no need to type owner/repo separately unless you use
              Advanced). Your OAuth app needs the <code className="text-xs">repo</code> scope so we can commit.
            </p>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Active for pull / push
              </p>
              {owner.trim() && repoName.trim() ? (
                <p className="mt-1 font-mono text-sm text-slate-900 dark:text-white">
                  {owner.trim()}/{repoName.trim()}{" "}
                  <span className="text-slate-500 dark:text-slate-400">@ {branch.trim() || "main"}</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Paste a URL or choose from your repos.</p>
              )}
            </div>

            <div className="mt-6 space-y-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Repository URL</label>
              <input
                type="url"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                placeholder="https://github.com/your-org/your-repo"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void applyPastedUrl()}
                  disabled={saving || !repositoryUrl.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" aria-hidden />}
                  Apply URL &amp; save
                </button>

                <div className="relative flex-1 min-w-[12rem]" ref={pickerRef}>
                  <button
                    type="button"
                    onClick={() => void handleOpenPicker()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:border-sky-400 hover:text-sky-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:text-sky-300"
                  >
                    <Search className="h-4 w-4 shrink-0" aria-hidden />
                    Browse repositories
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                  </button>

                  {showPicker && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      <div className="border-b border-slate-100 p-2 dark:border-slate-800">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search repos…"
                            value={repoSearch}
                            onChange={(e) => setRepoSearch(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {loadingRepos ? (
                          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading repos…
                          </div>
                        ) : repoError ? (
                          <p className="p-3 text-xs text-red-600 dark:text-red-400">{repoError}</p>
                        ) : filteredRepos.length === 0 ? (
                          <p className="p-3 text-xs text-slate-500 dark:text-slate-400">No repositories found.</p>
                        ) : (
                          filteredRepos.map((r) => (
                            <button
                              key={r.fullName}
                              type="button"
                              onClick={() => void pickRepo(r)}
                              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
                            >
                              {r.private ? (
                                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                              ) : (
                                <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{r.fullName}</p>
                                {r.description ? (
                                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{r.description}</p>
                                ) : (
                                  <p className="text-xs text-slate-400 dark:text-slate-500">
                                    Default branch: {r.defaultBranch}
                                  </p>
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <details className="mt-6 rounded-lg border border-dashed border-slate-200 p-4 dark:border-slate-700">
              <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                Advanced: edit owner, repo name, and branch manually
              </summary>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="block min-w-[8rem] flex-1 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Owner</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="org-or-user"
                    autoComplete="off"
                  />
                </label>
                <label className="block min-w-[8rem] flex-1 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Repository</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder="my-data-repo"
                    autoComplete="off"
                  />
                </label>
                <label className="block min-w-[8rem] flex-1 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Branch</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    autoComplete="off"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveManualAdvanced()}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" aria-hidden />}
                  Save
                </button>
              </div>
            </details>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pull from repo</h2>
              <button
                type="button"
                disabled={!canSync || pulling}
                onClick={() => void pullDeclarations()}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-500 dark:hover:bg-sky-600"
              >
                {pulling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" aria-hidden />}
                Import YAML into eltPulse
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Reads every <code className="text-xs">*.yaml</code> / <code className="text-xs">*.yml</code> under{" "}
              <code className="text-xs">eltpulse/pipelines</code> and upserts pipelines by name (same as{" "}
              <code className="text-xs">POST /api/elt/pipelines/declaration?mode=upsert</code>
              ).
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Push to repo</h2>
              {loadingPipelines ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="Loading" />
              ) : null}
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Writes each pipeline as a declarative YAML file. Existing files are updated on the same branch.
            </p>

            {!pipelines || pipelines.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                No pipelines yet.{" "}
                <Link href="/builder" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                  Create one in the builder
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {pipelines.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{p.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {p.sourceType} → {p.destinationType}
                        {!p.enabled ? " · disabled" : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canSync || pushingId === p.id}
                      onClick={() => void pushPipeline(p.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {pushingId === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUpFromLine className="h-4 w-4" />
                      )}
                      Push YAML
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
