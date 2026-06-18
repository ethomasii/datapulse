"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Database, Loader2, Search } from "lucide-react";
import type { WorkspaceAsset, WorkspaceAssetsResponse } from "@/lib/elt/pipeline-assets";
import { tableRefFromAsset } from "@/lib/elt/table-asset-fields";

type Props = {
  pipelineId?: string;
  value: string;
  onChange: (tableRef: string, asset?: WorkspaceAsset) => void;
  readOnly?: boolean;
  placeholder?: string;
};

/** Single-select warehouse table picker (pipeline-scoped when pipelineId set). */
export function PipelineTableAssetPicker({
  pipelineId,
  value,
  onChange,
  readOnly = false,
  placeholder = "Search tables & assets…",
}: Props) {
  const [assets, setAssets] = useState<WorkspaceAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (pipelineId) qs.set("pipelineId", pipelineId);
      const res = await fetch(`/api/elt/assets?${qs}`, { credentials: "same-origin" });
      if (!res.ok) return;
      const body = (await res.json()) as WorkspaceAssetsResponse;
      const rows = (body.assets ?? []).filter(
        (a) => a.kind === "raw" || a.kind === "transform" || a.kind === "post_transform"
      );
      setAssets(rows);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets.slice(0, 40);
    return assets
      .filter((a) => {
        const ref = tableRefFromAsset(a).toLowerCase();
        return (
          ref.includes(q) ||
          a.displayName.toLowerCase().includes(q) ||
          a.pipelineName.toLowerCase().includes(q)
        );
      })
      .slice(0, 40);
  }, [assets, query]);

  if (readOnly) {
    return (
      <input
        readOnly
        value={value}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
      />
    );
  }

  return (
    <div className="relative mt-1">
      <div className="flex gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          aria-expanded={open}
        >
          <Database className="h-3.5 w-3.5" aria-hidden />
          Pick
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
      </div>
      {open ? (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-950">
          <div className="relative border-b border-slate-100 p-2 dark:border-slate-800">
            <Search className="pointer-events-none absolute left-4 top-3.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by table or pipeline…"
              className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-xs dark:border-slate-600 dark:bg-slate-900"
              autoFocus
            />
          </div>
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : (
            <ul className="max-h-44 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-3 py-3 text-center text-xs text-slate-500">No matching tables</li>
              ) : (
                filtered.map((a) => {
                  const ref = tableRefFromAsset(a);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-sky-50 dark:hover:bg-sky-950/30"
                        onClick={() => {
                          onChange(ref, a);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <span className="block font-mono text-xs text-slate-900 dark:text-white">{ref}</span>
                        <span className="block text-[10px] text-slate-500">
                          {a.pipelineName} · {a.kind}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
