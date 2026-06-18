"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Package, Plus, Trash2 } from "lucide-react";

type ResolvedCatalog = { input: string; id: string; rawBase: string };

export function ComponentCatalogSettings({ className }: { className?: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [resolved, setResolved] = useState<ResolvedCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/elt/workspace-catalog-sources", { credentials: "same-origin" });
      const data = (await res.json()) as {
        componentCatalogUrls?: string[];
        resolved?: ResolvedCatalog[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setUrls(data.componentCatalogUrls ?? []);
      setResolved(data.resolved ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: string[]) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/elt/workspace-catalog-sources", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ componentCatalogUrls: next }),
      });
      const data = (await res.json()) as {
        componentCatalogUrls?: string[];
        resolved?: ResolvedCatalog[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setUrls(data.componentCatalogUrls ?? []);
      setResolved(data.resolved ?? []);
      setMessage("Component catalogs saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function addUrl() {
    const v = draft.trim();
    if (!v) return;
    const next = [...urls, v];
    setDraft("");
    void save(next);
  }

  function removeUrl(idx: number) {
    const next = urls.filter((_, i) => i !== idx);
    void save(next);
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading component catalogs…</p>;
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <Package className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
        Component catalogs
      </div>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        Add GitHub repos with <code className="text-[11px]">component.json</code> +{" "}
        <code className="text-[11px]">compile.mjs</code> — merged into the builder palette and pipeline compile
        (bring-your-own packages). Use <code className="text-[11px]">owner/repo</code> or a raw GitHub URL.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="acme-corp/our-components"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
          disabled={saving}
        />
        <button
          type="button"
          onClick={() => addUrl()}
          disabled={saving || !draft.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </div>

      {urls.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {urls.map((u, i) => {
            const r = resolved.find((x) => x.input === u);
            return (
              <li
                key={`${u}-${i}`}
                className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800 dark:text-slate-200">{u}</p>
                  {r ? (
                    <p className="truncate text-[11px] text-slate-500">{r.id}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeUrl(i)}
                  disabled={saving}
                  className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                  aria-label={`Remove ${u}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          No custom catalogs — using default{" "}
          <code className="text-[11px]">ethomasii/eltpulse-pipeline-components</code>.
        </p>
      )}

      {message ? <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
