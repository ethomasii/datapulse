"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { WorkspaceAsset, WorkspaceAssetsResponse } from "@/lib/elt/pipeline-assets";

type Props = {
  selected: string[];
  onChange: (keys: string[]) => void;
  maxHeight?: string;
  /** When set, only assets from this pipeline are listed. */
  pipelineId?: string;
  readOnly?: boolean;
};

export function CatalogAssetPicker({
  selected,
  onChange,
  maxHeight = "max-h-48",
  pipelineId,
  readOnly = false,
}: Props) {
  const [assets, setAssets] = useState<WorkspaceAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const qs = new URLSearchParams();
        if (pipelineId) qs.set("pipelineId", pipelineId);
        const res = await fetch(`/api/elt/assets?${qs}`, { credentials: "same-origin" });
        if (res.ok) {
          const body = (await res.json()) as WorkspaceAssetsResponse;
          setAssets(body.assets ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [pipelineId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.pipelineName.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
    );
  }, [assets, query]);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((k) => k !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading assets…
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search assets by name or pipeline…"
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
      </div>
      <p className="text-xs text-slate-500">{selected.length} selected</p>
      <ul className={`overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 ${maxHeight}`}>
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-center text-sm text-slate-500">No matching assets</li>
        ) : (
          filtered.map((a) => (
            <li key={a.id}>
              <label className="flex cursor-pointer items-start gap-2 border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50">
                <input
                  type="checkbox"
                  checked={selected.includes(a.id)}
                  onChange={() => toggle(a.id)}
                  disabled={readOnly}
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900 dark:text-white">{a.displayName}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {a.pipelineName} · {a.kind}
                  </span>
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
