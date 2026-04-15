"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Database,
  Layers,
  Loader2,
  Play,
  TableProperties,
  Waypoints,
} from "lucide-react";
import { RelatedLinks } from "@/components/ui/related-links";
import { SliceCoveragePanel } from "@/components/elt/slice-coverage-panel";
import {
  EMPTY_PARTITION,
  PartitionConfigEditor,
  type PartitionConfig,
} from "@/components/elt/partition-config-editor";
import { getRunSliceCapability } from "@/lib/elt/run-slice-capabilities";

type PipelineSummary = {
  id: string;
  name: string;
  sourceType: string;
  destinationType: string;
  partitionConfig?: PartitionConfig;
};

// --- Main page ---

export default function RunSlicesPage() {
  const searchParams = useSearchParams();
  const pipelineRaw = searchParams.get("pipeline");
  const pipelineFromUrl = pipelineRaw && pipelineRaw.length > 0 ? pipelineRaw : null;

  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/elt/pipelines');
      if (!res.ok) throw new Error('Failed to load pipelines');
      const data = await res.json() as { pipelines: any[] };
      // Load full pipeline details (including sourceConfiguration) for each
      const detailed = await Promise.all(
        data.pipelines.map(async p => {
          const r = await fetch(`/api/elt/pipelines/${p.id}`);
          if (!r.ok) return { ...p, partitionConfig: undefined };
          const d = await r.json() as { pipeline: any };
          const sc = d.pipeline.sourceConfiguration ?? {};
          return {
            id: p.id,
            name: p.name,
            sourceType: p.sourceType,
            destinationType: p.destinationType,
            partitionConfig: sc._partitionConfig as PartitionConfig | undefined,
          };
        })
      );
      setPipelines(detailed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="w-full min-w-0 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-teal-600 dark:text-teal-400">
          <TableProperties className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Run slicing</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Run slices & backfills</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          The <strong className="font-medium text-slate-800 dark:text-slate-200">Partition-style coverage</strong> block
          below is the Dagster-like view: <strong className="font-medium text-slate-800 dark:text-slate-200">latest status per slice</strong>, not
          every historical attempt (use{" "}
          <Link href="/runs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Runs
          </Link>{" "}
          with <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">?pipeline=…</code> for the full log).
          Configure column and granularity in each pipeline row, launch backfills from the editor, fill date gaps in
          coverage, and re-queue failed or missing slices — same as partition backfill / materialize, as long as your
          runner honors <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">triggeredBy</code>.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="mt-1 text-xs text-red-600 dark:text-red-400">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading pipelines…</span>
        </div>
      ) : pipelines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-700">
          <Layers className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-medium text-slate-900 dark:text-white">No pipelines yet</h3>
          <p className="mt-1 text-sm text-slate-500">Create a pipeline first, then configure run slices here.</p>
          <Link
            href="/builder"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            <Layers className="h-4 w-4" /> Create pipeline
          </Link>
        </div>
      ) : (
        <>
          <SliceCoveragePanel pipelines={pipelines} initialPipelineId={pipelineFromUrl} />
          <div className="space-y-6">
            {pipelines.map(p => (
              <PipelinePartitionCard
                key={p.id}
                pipeline={p}
                onSaved={load}
                onError={setError}
              />
            ))}
          </div>
        </>
      )}

      {/* Concept reference */}
      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Database className="h-4 w-4 text-teal-600" />
          How run slices work
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
          <div>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Date slice</strong>
            <p className="mt-1">Slice by a timestamp column (day, week, month, year). Perfect for event tables, append-only logs, and incremental syncs.</p>
          </div>
          <div>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Key slice</strong>
            <p className="mt-1">Slice by a discrete value — customer ID, region, tenant. Each slice value becomes an isolated run.</p>
          </div>
          <div>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Backfill</strong>
            <p className="mt-1">Re-run one or more slice values on demand. Each slice launches its own run record you can track and retry independently.</p>
          </div>
        </div>
      </section>

      {pipelines.length > 0 ? (
        <RelatedLinks links={[
          { href: "/runs", icon: Play, label: "Runs", desc: "Full run history and live telemetry for every execution" },
          { href: "/builder", icon: Layers, label: "Pipelines", desc: "Define the source → destination connections being backfilled" },
          { href: "/gateway", icon: Waypoints, label: "Gateway & execution", desc: "Configure where backfill runs execute" },
        ]} />
      ) : null}
    </div>
  );
}

// ─── Per-pipeline card (always expanded) ──────────────────────────────────────

function PipelinePartitionCard({
  pipeline,
  onSaved,
  onError,
}: {
  pipeline: PipelineSummary;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const cfg = pipeline.partitionConfig;
  const hasPartition = cfg && cfg.type !== 'none';
  const cap = getRunSliceCapability(pipeline.sourceType);
  const unsupportedSavedSlice = cap.mode === "none_only" && hasPartition;

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <Layers className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="font-semibold text-slate-900 dark:text-white">{pipeline.name}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {pipeline.sourceType}
        </span>
        <span className="text-xs text-slate-400">→</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{pipeline.destinationType}</span>
        <span className="rounded-full bg-teal-50 px-2 py-0.5 font-mono text-[10px] text-teal-700 dark:bg-teal-900/20 dark:text-teal-400" title={cap.detail}>
          {cap.label}
        </span>
        {hasPartition ? (
          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
            {cfg!.type === 'date' ? `Date · ${cfg!.column} / ${cfg!.granularity}` : `Key · ${cfg!.column}`}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
            No slice configured
          </span>
        )}
        {unsupportedSavedSlice && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            Saved config not used — save to clear
          </span>
        )}
      </div>
      <div className="px-5 pb-6 pt-5">
        <PartitionConfigEditor
          key={pipeline.id}
          pipelineId={pipeline.id}
          sourceType={pipeline.sourceType}
          seed={pipeline.partitionConfig ?? EMPTY_PARTITION}
          showBackfill
          onSaved={onSaved}
          onError={onError}
        />
      </div>
    </div>
  );
}
