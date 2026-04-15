"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";

export type PipelinePickerRow = {
  id: string;
  name: string;
  tool: string;
  enabled: boolean;
  sourceType: string;
  destinationType: string;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function pipelineMatchesPickerQuery(row: PipelinePickerRow, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  return (
    norm(row.name).includes(q) ||
    row.id.toLowerCase().includes(q) ||
    norm(row.tool).includes(q) ||
    norm(row.sourceType).includes(q) ||
    norm(row.destinationType).includes(q)
  );
}

type PipelineSearchFieldProps = {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

function PipelineSearchField({ id, value, onChange, placeholder }: PipelineSearchFieldProps) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        id={id}
        type="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search by name, id, tool, source…"}
        className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
    </div>
  );
}

type PipelineMultiPickerProps = {
  pipelines: PipelinePickerRow[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  /** Scrollable list max height (Tailwind class). */
  listMaxHeightClass?: string;
};

export function PipelineMultiPicker({
  pipelines,
  selectedIds,
  onToggle,
  loading,
  emptyMessage = "No pipelines found. Create one in the Builder first, then return here.",
  listMaxHeightClass = "max-h-72",
}: PipelineMultiPickerProps) {
  const searchId = useId();
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(
    () => pipelines.filter((p) => pipelineMatchesPickerQuery(p, query)),
    [pipelines, query]
  );

  const hiddenSelectedCount = useMemo(() => {
    if (!query.trim()) return 0;
    return selectedIds.filter((id) => {
      const row = pipelines.find((p) => p.id === id);
      return row && !pipelineMatchesPickerQuery(row, query);
    }).length;
  }, [pipelines, query, selectedIds]);

  if (loading) {
    return (
      <div className="rounded-md border border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-slate-600">
        Loading pipelines…
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PipelineSearchField id={searchId} value={query} onChange={setQuery} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span>
          <span className="font-medium text-slate-700 dark:text-slate-300">{selectedIds.length}</span> selected
        </span>
        <span aria-hidden>·</span>
        <span>
          Showing{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">{filtered.length}</span> of{" "}
          {pipelines.length}
        </span>
      </div>
      {hiddenSelectedCount > 0 ? (
        <p className="text-xs text-amber-800 dark:text-amber-200/90">
          {hiddenSelectedCount} selected pipeline{hiddenSelectedCount === 1 ? "" : "s"} not in this search — clear search to
          see every selected row in the list.
        </p>
      ) : null}
      <div
        className={`space-y-1 overflow-y-auto rounded-md border border-slate-300 p-2 dark:border-slate-600 ${listMaxHeightClass}`}
      >
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No pipelines match this search.</p>
        ) : (
          filtered.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-start gap-2 rounded px-1 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={selectedSet.has(p.id)}
                onChange={() => onToggle(p.id)}
              />
              <span className="min-w-0">
                <span className="font-medium text-slate-900 dark:text-slate-100">{p.name}</span>
                <span className="mt-0.5 block font-mono text-[11px] text-slate-500 dark:text-slate-400">{p.id}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {p.sourceType} → {p.destinationType} ({p.tool})
                  {!p.enabled ? " · disabled" : ""}
                </span>
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

type PipelineSinglePickerProps = {
  pipelines: PipelinePickerRow[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
};

export function PipelineSinglePicker({ pipelines, value, onChange, loading }: PipelineSinglePickerProps) {
  const searchId = useId();
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => pipelines.filter((p) => pipelineMatchesPickerQuery(p, query)),
    [pipelines, query]
  );

  const selected = useMemo(() => pipelines.find((p) => p.id === value) ?? null, [pipelines, value]);

  if (loading) {
    return (
      <div className="rounded-md border border-slate-200 px-3 py-3 text-sm text-slate-500 dark:border-slate-600">
        Loading pipelines…
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        No pipelines found. Create one in the Builder first.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {selected ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800/60">
          <span className="font-medium text-slate-900 dark:text-slate-100">{selected.name}</span>
          <span className="mt-0.5 block font-mono text-[11px] text-slate-500 dark:text-slate-400">{selected.id}</span>
        </p>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">Choose a pipeline below.</p>
      )}
      <PipelineSearchField id={searchId} value={query} onChange={setQuery} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span>
          Showing{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">{filtered.length}</span> of {pipelines.length}
        </span>
      </div>
      <ul
        className="max-h-60 space-y-0.5 overflow-y-auto rounded-md border border-slate-300 p-1 dark:border-slate-600"
        role="listbox"
        aria-label="Pipelines"
      >
        {filtered.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No pipelines match this search.</li>
        ) : (
          filtered.map((p) => {
            const isOn = p.id === value;
            return (
              <li key={p.id} role="option" aria-selected={isOn}>
                <button
                  type="button"
                  onClick={() => onChange(p.id)}
                  className={`flex w-full flex-col items-start rounded px-2 py-2 text-left text-sm transition-colors ${
                    isOn
                      ? "bg-sky-100 text-sky-950 dark:bg-sky-900/40 dark:text-sky-100"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  }`}
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">{p.name}</span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{p.id}</span>
                  <span className="text-xs text-slate-500">
                    {p.sourceType} → {p.destinationType} ({p.tool})
                    {!p.enabled ? " · disabled" : ""}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
