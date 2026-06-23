"use client";

import { type FormEvent } from "react";
import Link from "next/link";
import clsx from "clsx";
import { WorkspaceLakeBanner } from "@/components/elt/workspace-lake-banner";
import { DESTINATION_GROUPS, SOURCE_GROUPS } from "@/lib/elt/catalog";
import type { WorkspaceDefaultDestination } from "@/lib/hooks/use-workspace-default-destination";

export type NewPipelineKind = "elt" | "transform_only";

const PIPELINE_KIND_OPTIONS: ReadonlyArray<
  readonly [NewPipelineKind, string, string]
> = [
  ["elt", "Extract & load (EL+T)", "Connect a source and load into your warehouse"],
  [
    "transform_only",
    "Transform only (warehouse)",
    "Data already in your default warehouse — build native transform steps",
  ],
];

export function PipelineKindPicker({
  kind,
  onKindChange,
  className,
}: {
  kind: NewPipelineKind;
  onKindChange: (kind: NewPipelineKind) => void;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-wrap gap-2", className)}>
      {PIPELINE_KIND_OPTIONS.map(([id, label, hint]) => (
        <button
          key={id}
          type="button"
          onClick={() => onKindChange(id)}
          className={clsx(
            "rounded-lg border px-3 py-2 text-left text-xs transition",
            kind === id
              ? "border-violet-400 bg-violet-50 text-violet-950 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-100"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
          )}
        >
          <span className="block font-semibold">{label}</span>
          <span className="mt-0.5 block text-[10px] opacity-80">{hint}</span>
        </button>
      ))}
    </div>
  );
}

type Props = {
  title: string;
  kind: NewPipelineKind;
  onKindChange: (kind: NewPipelineKind) => void;
  name: string;
  onNameChange: (name: string) => void;
  sourceTable: string;
  onSourceTableChange: (table: string) => void;
  sourceType: string;
  onSourceTypeChange: (type: string) => void;
  destinationType: string;
  onDestinationTypeChange: (type: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => void;
  submitLabel?: string;
  showCancel?: boolean;
  onCancel?: () => void;
  workspaceDefault: WorkspaceDefaultDestination;
  /** When false, ELT mode hides source/destination (builder uses browse/AI/manual instead). */
  showEltSourceDest?: boolean;
  /** When false, kind picker is rendered elsewhere (e.g. builder page header). */
  showKindPicker?: boolean;
  className?: string;
};

export function NewPipelineForm({
  title,
  kind,
  onKindChange,
  name,
  onNameChange,
  sourceTable,
  onSourceTableChange,
  sourceType,
  onSourceTypeChange,
  destinationType,
  onDestinationTypeChange,
  busy,
  error,
  onSubmit,
  submitLabel = "Create & open canvas",
  showCancel = false,
  onCancel,
  workspaceDefault,
  showEltSourceDest = true,
  showKindPicker = true,
  className,
}: Props) {
  return (
    <form
      onSubmit={onSubmit}
      className={clsx(
        "space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40",
        className
      )}
    >
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{title}</p>
      {showKindPicker ? <PipelineKindPicker kind={kind} onKindChange={onKindChange} /> : null}
      {workspaceDefault.connector ? (
        <WorkspaceLakeBanner
          connector={workspaceDefault.connector}
          name={workspaceDefault.name}
          variant="compact"
        />
      ) : kind === "transform_only" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          No default warehouse yet — set one under{" "}
          <Link href="/connections" className="font-medium underline">
            Connections
          </Link>{" "}
          for a one-click transform pipeline.
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="my_pipeline"
          autoComplete="off"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          disabled={busy}
        />
        <span className="text-xs text-slate-500">Letters, numbers, underscore; start with a letter.</span>
      </label>
      {kind === "transform_only" ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Input table</span>
          <input
            type="text"
            value={sourceTable}
            onChange={(e) => onSourceTableChange(e.target.value)}
            placeholder="staging.events"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            disabled={busy}
          />
          <span className="text-xs text-slate-500">
            Existing warehouse table this pipeline reads from (schema.table).
          </span>
        </label>
      ) : showEltSourceDest ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Source</span>
            <select
              value={sourceType}
              onChange={(e) => onSourceTypeChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              disabled={busy}
            >
              {Object.entries(SOURCE_GROUPS).map(([group, types]) => (
                <optgroup key={group} label={group}>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Destination</span>
            <select
              value={destinationType}
              onChange={(e) => onDestinationTypeChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              disabled={busy}
            >
              {Object.entries(DESTINATION_GROUPS).map(([group, types]) => (
                <optgroup key={group} label={group}>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          {busy ? "Creating…" : submitLabel}
        </button>
        {showCancel && onCancel ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
