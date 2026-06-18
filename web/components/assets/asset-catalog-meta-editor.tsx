"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  assetKey: string;
  kind: string;
  pipelineId?: string;
  initialDescription?: string;
  initialTags?: string[];
  variant?: "inline" | "detail";
  onSaved?: () => void;
};

export function AssetCatalogMetaEditor({
  assetKey,
  kind,
  pipelineId,
  initialDescription = "",
  initialTags = [],
  variant = "inline",
  onSaved,
}: Props) {
  const [description, setDescription] = useState(initialDescription);
  const [tagsText, setTagsText] = useState(initialTags.join(", "));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const tags = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch("/api/elt/catalog/entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetKey, kind, pipelineId, description: description || null, tags }),
      });
      if (res.ok) {
        setSaved(true);
        onSaved?.();
      }
    } finally {
      setSaving(false);
    }
  }

  const isDetail = variant === "detail";

  return (
    <div className={isDetail ? "space-y-4" : "mt-2 space-y-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"}>
      {!isDetail ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Catalog metadata</p>
      ) : null}
      <div>
        {!isDetail ? null : (
          <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Description</label>
        )}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={isDetail ? 5 : 2}
          placeholder="What this asset contains, freshness expectations, ownership, links to docs…"
          className={
            isDetail
              ? "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              : "w-full rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-950"
          }
        />
      </div>
      <div>
        {!isDetail ? null : (
          <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Tags</label>
        )}
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="Tags (comma-separated, e.g. pii, finance, daily)"
          className={
            isDetail
              ? "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              : "w-full rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-950"
          }
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={
            isDetail
              ? "rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              : "rounded bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          }
        >
          {saving ? <Loader2 className="inline h-4 w-4 animate-spin" /> : "Save metadata"}
        </button>
        {saved ? <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved</span> : null}
      </div>
    </div>
  );
}
