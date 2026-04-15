'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  TableProperties,
  Waypoints,
} from 'lucide-react';
import { RelatedLinks } from "@/components/ui/related-links";
import { SliceCoveragePanel } from "@/components/elt/slice-coverage-panel";
import { getRunSliceCapability } from "@/lib/elt/run-slice-capabilities";

// ─── Column hints ─────────────────────────────────────────────────────────────

/** Common date/timestamp columns by source type. */
const DATE_COLUMN_HINTS: Record<string, string[]> = {
  postgres:         ['created_at', 'updated_at', 'event_date', 'timestamp', 'date'],
  mysql:            ['created_at', 'updated_at', 'event_date', 'timestamp', 'date'],
  mongodb:          ['createdAt', 'updatedAt', 'timestamp', 'date'],
  stripe:           ['created', 'updated', 'event_date'],
  shopify:          ['created_at', 'updated_at', 'processed_at'],
  salesforce:       ['CreatedDate', 'LastModifiedDate', 'SystemModstamp'],
  hubspot:          ['createdate', 'lastmodifieddate', 'hs_timestamp'],
  google_analytics: ['date', 'event_date', 'session_date'],
  zendesk:          ['created_at', 'updated_at'],
  jira:             ['created', 'updated', 'resolutiondate'],
  slack:            ['ts', 'event_ts', 'thread_ts'],
  s3:               ['date', 'event_date', 'partition_date'],
  csv:              ['date', 'created_at', 'timestamp'],
  rest_api:         ['created_at', 'updated_at', 'timestamp', 'date'],
  github:           ['created_at', 'updated_at', 'merged_at', 'closed_at'],
};

/** Common key/dimension columns by source type. */
const KEY_COLUMN_HINTS: Record<string, string[]> = {
  postgres:         ['customer_id', 'tenant_id', 'region', 'status', 'user_id'],
  mysql:            ['customer_id', 'tenant_id', 'region', 'status', 'user_id'],
  mongodb:          ['customerId', 'tenantId', 'region', 'status'],
  stripe:           ['customer', 'currency', 'status', 'payment_method_types'],
  shopify:          ['customer_id', 'vendor', 'product_type', 'fulfillment_status'],
  salesforce:       ['AccountId', 'OwnerId', 'Type', 'Status', 'Region__c'],
  hubspot:          ['hs_object_id', 'dealstage', 'pipeline', 'hubspot_owner_id'],
  google_analytics: ['country', 'device_category', 'channel_grouping'],
  zendesk:          ['organization_id', 'status', 'priority', 'type', 'assignee_id'],
  jira:             ['project_key', 'issuetype', 'status', 'assignee', 'priority'],
  slack:            ['channel', 'user', 'team'],
  s3:               ['region', 'customer_id', 'tenant'],
  csv:              ['region', 'customer_id', 'category', 'status'],
  rest_api:         ['id', 'status', 'type', 'category'],
  github:           ['repo', 'state', 'author', 'label'],
};

function getColumnHints(sourceType: string, partitionType: 'date' | 'key'): string[] {
  const src = sourceType.toLowerCase();
  return partitionType === 'date'
    ? (DATE_COLUMN_HINTS[src] ?? ['created_at', 'updated_at', 'date', 'timestamp'])
    : (KEY_COLUMN_HINTS[src] ?? ['customer_id', 'region', 'status', 'type']);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PartitionType = 'date' | 'key' | 'none';

type PartitionConfig = {
  type: PartitionType;
  column: string;        // e.g. "created_at", "region", "customer_id"
  granularity: string;  // date only: "day" | "week" | "month" | "year"
  description: string;
};

type PipelineSummary = {
  id: string;
  name: string;
  sourceType: string;
  destinationType: string;
  partitionConfig?: PartitionConfig;
};

type BackfillRangeRow = {
  value: string;       // e.g. "2024-01-15" or "us-east" depending on type
  selected: boolean;
};

// ─── Helpers ───────────────────────────────────────────────────��─────────────

function dateRange(start: string, end: string, granularity: string): string[] {
  const dates: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return dates;
  const cur = new Date(s);
  let limit = 0;
  while (cur <= e && limit < 500) {
    if (granularity === 'day') {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    } else if (granularity === 'week') {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 7);
    } else if (granularity === 'month') {
      dates.push(cur.toISOString().slice(0, 7));
      cur.setMonth(cur.getMonth() + 1);
    } else if (granularity === 'year') {
      dates.push(cur.toISOString().slice(0, 4));
      cur.setFullYear(cur.getFullYear() + 1);
    } else {
      break;
    }
    limit++;
  }
  return dates;
}

// --- Main page ---

export default function RunSlicesPage() {
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
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

  const selectedPipeline = pipelines.find(p => p.id === selected) ?? null;

  return (
    <div className="w-full min-w-0 max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-teal-600 dark:text-teal-400">
          <TableProperties className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Run slicing</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Run slices & backfills</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Configure how each pipeline slices its data — by date, key, region, or customer — then run targeted
          backfills over any range of slice values. Each slice launches an independent run you can
          monitor in{' '}
          <Link href="/runs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">Runs</Link>.
          Slice types shown here match what the stock generated pipeline can honor; connectors like GitHub and generic
          REST do not apply partition keys in generated code, so date/key slices are disabled until you customize the loader.
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
          <SliceCoveragePanel pipelines={pipelines} />
          <div className="space-y-3">
            {pipelines.map(p => (
              <PipelinePartitionRow
                key={p.id}
                pipeline={p}
                expanded={selected === p.id}
                onToggle={() => setSelected(prev => prev === p.id ? null : p.id)}
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

// ─── Per-pipeline row ─────────────────────────────────────────────────────────

function PipelinePartitionRow({
  pipeline,
  expanded,
  onToggle,
  onSaved,
  onError,
}: {
  pipeline: PipelineSummary;
  expanded: boolean;
  onToggle: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const cfg = pipeline.partitionConfig;
  const hasPartition = cfg && cfg.type !== 'none';
  const cap = getRunSliceCapability(pipeline.sourceType);
  const unsupportedSavedSlice = cap.mode === "none_only" && hasPartition;

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Layers className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="font-medium text-slate-900 dark:text-white">{pipeline.name}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {pipeline.sourceType}
          </span>
          {cap.mode === "none_only" ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              {cap.label}
            </span>
          ) : hasPartition ? (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
              {cfg!.type === 'date' ? `Date · ${cfg!.column} / ${cfg!.granularity}` : `Key · ${cfg!.column}`}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
              No run slice
            </span>
          )}
          {unsupportedSavedSlice ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              Saved slice config not used — save to clear
            </span>
          ) : null}
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-5 pb-6 pt-4 dark:border-slate-800">
          <PartitionEditor key={pipeline.id} pipeline={pipeline} onSaved={onSaved} onError={onError} />
        </div>
      )}
    </div>
  );
}

// ─── Partition Config Editor + Backfill Launcher ─────────────────────────────

function PartitionEditor({
  pipeline,
  onSaved,
  onError,
}: {
  pipeline: PipelineSummary;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const cap = getRunSliceCapability(pipeline.sourceType);
  const init = pipeline.partitionConfig ?? { type: 'none', column: '', granularity: 'day', description: '' };
  const [type, setType] = useState<PartitionType>(() =>
    cap.mode === "none_only" ? "none" : init.type
  );
  const [column, setColumn] = useState(() => (cap.mode === "none_only" ? "" : init.column));
  const [granularity, setGranularity] = useState(init.granularity || 'day');
  const [description, setDescription] = useState(init.description || '');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Backfill state
  const [backfillTab, setBackfillTab] = useState<'date' | 'keys'>('date');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [keyList, setKeyList] = useState('');
  const [backfillRows, setBackfillRows] = useState<BackfillRangeRow[]>([]);
  const [previewReady, setPreviewReady] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<{ launched: number; errors: string[] } | null>(null);

  async function saveConfig() {
    setSaving(true);
    try {
      // Store partition config inside sourceConfiguration._partitionConfig
      // We PATCH the existing sourceConfiguration to merge our key in
      const getRes = await fetch(`/api/elt/pipelines/${pipeline.id}`);
      if (!getRes.ok) throw new Error('Failed to fetch pipeline');
      const { pipeline: full } = await getRes.json() as { pipeline: any };
      const effectiveType: PartitionType = cap.mode === "none_only" ? "none" : type;
      const effectiveColumn = cap.mode === "none_only" ? "" : column.trim();
      const sc = {
        ...(full.sourceConfiguration ?? {}),
        _partitionConfig: {
          type: effectiveType,
          column: effectiveColumn,
          granularity,
          description: description.trim(),
        },
      };

      const res = await fetch(`/api/elt/pipelines/${pipeline.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceConfiguration: sc }),
      });
      if (!res.ok) throw new Error('Failed to save run slice config');
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function buildPreview() {
    if (type === 'date' || backfillTab === 'date') {
      const vals = dateRange(dateStart, dateEnd, granularity);
      setBackfillRows(vals.map(v => ({ value: v, selected: true })));
    } else {
      const vals = keyList.split('\n').map(l => l.trim()).filter(Boolean);
      setBackfillRows(vals.map(v => ({ value: v, selected: true })));
    }
    setPreviewReady(true);
    setLaunchResult(null);
  }

  function toggleRow(idx: number) {
    setBackfillRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  }

  function toggleAll() {
    const allSelected = backfillRows.every(r => r.selected);
    setBackfillRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  }

  async function launchBackfills() {
    const selected = backfillRows.filter(r => r.selected);
    if (selected.length === 0) return;
    setLaunching(true);
    setLaunchResult(null);
    let launched = 0;
    const errors: string[] = [];

    for (const row of selected) {
      try {
        const res = await fetch('/api/elt/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pipelineId: pipeline.id,
            environment: 'backfill',
            triggeredBy: `backfill:partition:${column}:${row.value}`,
            status: 'pending',
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as any;
          errors.push(`${row.value}: ${d.error ?? res.statusText}`);
        } else {
          launched++;
        }
      } catch (e) {
        errors.push(`${row.value}: ${e instanceof Error ? e.message : 'Unknown'}`);
      }
    }

    setLaunchResult({ launched, errors });
    setLaunching(false);
  }

  const isDate = type === 'date';
  const canLaunch = previewReady && backfillRows.some(r => r.selected) && (type !== 'none') && column.trim();
  const slicesDisabled = cap.mode === "none_only";

  if (slicesDisabled) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">Date and key run slices are not available for this source type</p>
          <p className="mt-2 text-xs leading-relaxed opacity-95">{cap.detail}</p>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Source: <span className="font-mono">{pipeline.sourceType}</span>. You can still run full loads; each run appears
          in <Link href="/runs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">Runs</Link> without
          slice metadata.
        </p>
        {(init.type !== "none" && init.column) || init.description ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-slate-700 dark:text-slate-200">
              A slice configuration was saved earlier. Save below to clear it and store &quot;none&quot; so the pipeline
              metadata matches what the stock loader supports.
            </p>
            <button
              type="button"
              onClick={() => void saveConfig()}
              disabled={saving}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Clear slice config and save
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500 dark:text-slate-400">{cap.detail}</p>
      {/* Config form */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Run slice configuration</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Slice type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as PartitionType)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            >
              <option value="none">None — full table each run</option>
              <option value="date">Date — slice by timestamp column</option>
              <option value="key">Key — slice by discrete value (region, customer, etc.)</option>
            </select>
          </div>

          {type !== 'none' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {isDate ? 'Date/timestamp column' : 'Key / dimension column'}
              </label>
              {/* datalist provides smart hints without restricting input */}
              <datalist id={`col-hints-${pipeline.id}`}>
                {getColumnHints(pipeline.sourceType, type as 'date' | 'key').map(h => (
                  <option key={h} value={h} />
                ))}
              </datalist>
              <input
                type="text"
                list={`col-hints-${pipeline.id}`}
                value={column}
                onChange={e => setColumn(e.target.value)}
                placeholder={isDate ? 'e.g. created_at' : 'e.g. region, customer_id'}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              />
              <p className="mt-1 text-xs text-slate-400">
                Suggestions based on <span className="font-medium">{pipeline.sourceType}</span> — type anything if your column differs.
              </p>
            </div>
          )}

          {type === 'date' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Granularity</label>
              <select
                value={granularity}
                onChange={e => setGranularity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
          )}

          {type !== 'none' && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Daily partitioned by event date, one run per day"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              />
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void saveConfig()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : savedFlash ? <CheckCircle2 className="h-4 w-4" /> : null}
            {savedFlash ? 'Saved' : 'Save config'}
          </button>
          {type !== 'none' && (
            <span className="text-xs text-slate-500">Save before launching backfills</span>
          )}
        </div>
      </div>

      {/* Backfill launcher */}
      {type !== 'none' && column.trim() && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-5 dark:border-teal-800 dark:bg-teal-900/10">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-1">
            <RotateCcw className="h-4 w-4 text-teal-600" />
            Backfill launcher
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Select a range of slice values, preview, then launch. Each value creates an independent run
            with <code className="font-mono">environment=backfill</code> visible in{' '}
            <Link href="/runs" className="text-sky-600 hover:underline dark:text-sky-400">Runs</Link>.
          </p>

          {/* Tabs */}
          <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-700">
            {isDate && (
              <button
                type="button"
                onClick={() => { setBackfillTab('date'); setPreviewReady(false); }}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${backfillTab === 'date' ? 'border-teal-600 text-teal-700 dark:text-teal-300' : 'border-transparent text-slate-500'}`}
              >
                Date range
              </button>
            )}
            <button
              type="button"
              onClick={() => { setBackfillTab('keys'); setPreviewReady(false); }}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${backfillTab === 'keys' ? 'border-teal-600 text-teal-700 dark:text-teal-300' : 'border-transparent text-slate-500'}`}
            >
              {isDate ? 'Specific values' : 'Key values'}
            </button>
          </div>

          {backfillTab === 'date' && isDate ? (
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Start</label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={e => { setDateStart(e.target.value); setPreviewReady(false); }}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">End</label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={e => { setDateEnd(e.target.value); setPreviewReady(false); }}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Values (one per line)</label>
              <textarea
                value={keyList}
                onChange={e => { setKeyList(e.target.value); setPreviewReady(false); }}
                rows={4}
                placeholder={isDate ? '2024-01-15\n2024-01-16\n2024-02-01' : 'us-east-1\nus-west-2\neu-central-1'}
                className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              />
            </div>
          )}

          <button
            type="button"
            onClick={buildPreview}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Preview slices
          </button>

          {previewReady && (
            <div className="mt-4">
              {backfillRows.length === 0 ? (
                <p className="text-sm text-slate-500">No slice values generated. Check your date range or values.</p>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {backfillRows.filter(r => r.selected).length} of {backfillRows.length} selected
                    </span>
                    <button type="button" onClick={toggleAll} className="text-xs text-sky-600 hover:underline dark:text-sky-400">
                      Toggle all
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    {backfillRows.map((row, idx) => (
                      <label
                        key={row.value}
                        className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                      >
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleRow(idx)}
                          className="rounded"
                        />
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{row.value}</span>
                      </label>
                    ))}
                  </div>

                  {launchResult ? (
                    <div className={`mt-3 rounded-lg p-3 text-sm ${launchResult.errors.length === 0 ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200'}`}>
                      <div className="flex items-center gap-2">
                        {launchResult.errors.length === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <span className="font-medium">
                          {launchResult.launched} run{launchResult.launched !== 1 ? 's' : ''} launched
                          {launchResult.errors.length > 0 ? `, ${launchResult.errors.length} error${launchResult.errors.length !== 1 ? 's' : ''}` : ''}
                        </span>
                      </div>
                      {launchResult.errors.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs">
                          {launchResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      )}
                      {launchResult.launched > 0 && (
                        <Link href="/runs" className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline">
                          View in Runs <ChevronRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void launchBackfills()}
                      disabled={launching || !canLaunch}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
                    >
                      {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      {launching ? 'Launching…' : `Launch ${backfillRows.filter(r => r.selected).length} backfill run${backfillRows.filter(r => r.selected).length !== 1 ? 's' : ''}`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
