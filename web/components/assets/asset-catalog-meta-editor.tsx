"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  assetKey: string;
  kind: string;
  pipelineId?: string;
  initialDescription?: string;
  initialTags?: string[];
};

export function AssetCatalogMetaEditor({
  assetKey,
  kind,
  pipelineId,
  initialDescription = "",
  initialTags = [],
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
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Catalog metadata</p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Description for data consumers…"
        className="w-full rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-950"
      />
      <input
        value={tagsText}
        onChange={(e) => setTagsText(e.target.value)}
        placeholder="Tags (comma-separated)"
        className="w-full rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-950"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save metadata"}
        </button>
        {saved ? <span className="text-[10px] text-emerald-600">Saved</span> : null}
      </div>
    </div>
  );
}
