"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";
import { getRunSliceCapability } from "@/lib/elt/run-slice-capabilities";

// ─── Column hints ─────────────────────────────────────────────────────────────

const DATE_COLUMN_HINTS: Record<string, string[]> = {
  postgres: ["created_at", "updated_at", "event_date", "timestamp", "date"],
  mysql: ["created_at", "updated_at", "event_date", "timestamp", "date"],
  mongodb: ["createdAt", "updatedAt", "timestamp", "date"],
  stripe: ["created", "updated", "event_date"],
  shopify: ["created_at", "updated_at", "processed_at"],
  salesforce: ["CreatedDate", "LastModifiedDate", "SystemModstamp"],
  hubspot: ["createdate", "lastmodifieddate", "hs_timestamp"],
  google_analytics: ["date", "event_date", "session_date"],
  zendesk: ["created_at", "updated_at"],
  jira: ["created", "updated", "resolutiondate"],
  slack: ["ts", "event_ts", "thread_ts"],
  s3: ["date", "event_date", "partition_date"],
  csv: ["date", "created_at", "timestamp"],
  rest_api: ["created_at", "updated_at", "timestamp", "date"],
  github: ["created_at", "updated_at", "merged_at", "closed_at"],
};

const KEY_COLUMN_HINTS: Record<string, string[]> = {
  postgres: ["customer_id", "tenant_id", "region", "status", "user_id"],
  mysql: ["customer_id", "tenant_id", "region", "status", "user_id"],
  mongodb: ["customerId", "tenantId", "region", "status"],
  stripe: ["customer", "currency", "status", "payment_method_types"],
  shopify: ["customer_id", "vendor", "product_type", "fulfillment_status"],
  salesforce: ["AccountId", "OwnerId", "Type", "Status", "Region__c"],
  hubspot: ["hs_object_id", "dealstage", "pipeline", "hubspot_owner_id"],
  google_analytics: ["country", "device_category", "channel_grouping"],
  zendesk: ["organization_id", "status", "priority", "type", "assignee_id"],
  jira: ["project_key", "issuetype", "status", "assignee", "priority"],
  slack: ["channel", "user", "team"],
  s3: ["region", "customer_id", "tenant"],
  csv: ["region", "customer_id", "category", "status"],
  rest_api: ["id", "status", "type", "category"],
  github: ["repo", "state", "author", "label"],
};

function getColumnHints(sourceType: string, partitionType: "date" | "key"): string[] {
  const src = sourceType.toLowerCase();
  return partitionType === "date"
    ? DATE_COLUMN_HINTS[src] ?? ["created_at", "updated_at", "date", "timestamp"]
    : KEY_COLUMN_HINTS[src] ?? ["customer_id", "region", "status", "type"];
}

export type PartitionType = "date" | "key" | "none";

export type PartitionConfig = {
  type: PartitionType;
  column: string;
  granularity: string;
  description: string;
};

export const EMPTY_PARTITION: PartitionConfig = {
  type: "none",
  column: "",
  granularity: "day",
  description: "",
};

type BackfillRangeRow = {
  value: string;
  selected: boolean;
};

function dateRange(start: string, end: string, granularity: string): string[] {
  const dates: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return dates;
  const cur = new Date(s);
  let limit = 0;
  while (cur <= e && limit < 500) {
    if (granularity === "day") {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    } else if (granularity === "week") {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 7);
    } else if (granularity === "month") {
      dates.push(cur.toISOString().slice(0, 7));
      cur.setMonth(cur.getMonth() + 1);
    } else if (granularity === "year") {
      dates.push(cur.toISOString().slice(0, 4));
      cur.setFullYear(cur.getFullYear() + 1);
    } else {
      break;
    }
    limit++;
  }
  return dates;
}

export type PartitionConfigEditorProps = {
  pipelineId: string;
  sourceType: string;
  /** When set, used as initial state (no GET). Omit to load `_partitionConfig` from the API. */
  seed?: PartitionConfig;
  showBackfill?: boolean;
  onSaved: () => void;
  onError: (msg: string) => void;
};

export function PartitionConfigEditor({
  pipelineId,
  sourceType,
  seed,
  showBackfill = true,
  onSaved,
  onError,
}: PartitionConfigEditorProps) {
  const cap = getRunSliceCapability(sourceType);
  const mergedSeed = seed ?? EMPTY_PARTITION;

  /** Snapshot of last known server config (for none_only “clear saved” messaging). */
  const [savedSnapshot, setSavedSnapshot] = useState<PartitionConfig>(() => mergedSeed);

  const [loadingInitial, setLoadingInitial] = useState(seed === undefined);
  const [type, setType] = useState<PartitionType>(() =>
    cap.mode === "none_only" ? "none" : mergedSeed.type
  );
  const [column, setColumn] = useState(() =>
    cap.mode === "none_only" ? "" : mergedSeed.column
  );
  const [granularity, setGranularity] = useState(mergedSeed.granularity || "day");
  const [description, setDescription] = useState(mergedSeed.description || "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [backfillTab, setBackfillTab] = useState<"date" | "keys">("date");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [keyList, setKeyList] = useState("");
  const [backfillRows, setBackfillRows] = useState<BackfillRangeRow[]>([]);
  const [previewReady, setPreviewReady] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<{ launched: number; errors: string[] } | null>(
    null
  );

  useEffect(() => {
    if (seed !== undefined) return;
    let cancelled = false;
    (async () => {
      setLoadingInitial(true);
      try {
        const getRes = await fetch(`/api/elt/pipelines/${pipelineId}`);
        if (!getRes.ok) throw new Error("Failed to fetch pipeline");
        const { pipeline: full } = (await getRes.json()) as { pipeline: { sourceConfiguration?: Record<string, unknown> } };
        const sc = full.sourceConfiguration ?? {};
        const raw = sc._partitionConfig as PartitionConfig | undefined;
        const init = raw ?? EMPTY_PARTITION;
        if (cancelled) return;
        setSavedSnapshot(init);
        setType(cap.mode === "none_only" ? "none" : init.type);
        setColumn(cap.mode === "none_only" ? "" : init.column);
        setGranularity(init.granularity || "day");
        setDescription(init.description || "");
      } catch (e) {
        if (!cancelled) onError(e instanceof Error ? e.message : "Failed to load slice config");
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pipelineId, seed, cap.mode, onError]);

  async function saveConfig() {
    setSaving(true);
    try {
      const getRes = await fetch(`/api/elt/pipelines/${pipelineId}`);
      if (!getRes.ok) throw new Error("Failed to fetch pipeline");
      const { pipeline: full } = (await getRes.json()) as { pipeline: { sourceConfiguration?: Record<string, unknown> } };
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

      const res = await fetch(`/api/elt/pipelines/${pipelineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceConfiguration: sc }),
      });
      if (!res.ok) throw new Error("Failed to save run slice config");
      setSavedSnapshot({
        type: effectiveType,
        column: effectiveColumn,
        granularity,
        description: description.trim(),
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function buildPreview() {
    if (type === "date" || backfillTab === "date") {
      const vals = dateRange(dateStart, dateEnd, granularity);
      setBackfillRows(vals.map((v) => ({ value: v, selected: true })));
    } else {
      const vals = keyList
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      setBackfillRows(vals.map((v) => ({ value: v, selected: true })));
    }
    setPreviewReady(true);
    setLaunchResult(null);
  }

  function toggleRow(idx: number) {
    setBackfillRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  }

  function toggleAll() {
    const allSelected = backfillRows.every((r) => r.selected);
    setBackfillRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  }

  async function launchBackfills() {
    const selected = backfillRows.filter((r) => r.selected);
    if (selected.length === 0) return;
    setLaunching(true);
    setLaunchResult(null);
    let launched = 0;
    const errors: string[] = [];

    for (const row of selected) {
      try {
        const res = await fetch("/api/elt/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            environment: "backfill",
            triggeredBy: `backfill:partition:${column}:${row.value}`,
            status: "pending",
          }),
        });
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          errors.push(`${row.value}: ${d.error ?? res.statusText}`);
        } else {
          launched++;
        }
      } catch (e) {
        errors.push(`${row.value}: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }

    setLaunchResult({ launched, errors });
    setLaunching(false);
  }

  const isDate = type === "date";
  const canLaunch = previewReady && backfillRows.some((r) => r.selected) && type !== "none" && column.trim();
  const slicesDisabled = cap.mode === "none_only";

  if (loadingInitial) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading slice configuration…
      </div>
    );
  }

  if (slicesDisabled) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">Date and key run slices are not available for this source type</p>
          <p className="mt-2 text-xs leading-relaxed opacity-95">{cap.detail}</p>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Source: <span className="font-mono">{sourceType}</span>. You can still run full loads; each run appears in{" "}
          <Link href="/runs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Runs
          </Link>{" "}
          without slice metadata.
        </p>
        {(savedSnapshot.type !== "none" && savedSnapshot.column) || savedSnapshot.description ? (
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
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Run slice configuration</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Slice type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PartitionType)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            >
              <option value="none">None — full table each run</option>
              <option value="date">Date — slice by timestamp column</option>
              <option value="key">Key — slice by discrete value (region, customer, etc.)</option>
            </select>
          </div>

          {type !== "none" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                {isDate ? "Date/timestamp column" : "Key / dimension column"}
              </label>
              <datalist id={`col-hints-${pipelineId}`}>
                {getColumnHints(sourceType, type as "date" | "key").map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>
              <input
                type="text"
                list={`col-hints-${pipelineId}`}
                value={column}
                onChange={(e) => setColumn(e.target.value)}
                placeholder={isDate ? "e.g. created_at" : "e.g. region, customer_id"}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              />
              <p className="mt-1 text-xs text-slate-400">
                Suggestions based on <span className="font-medium">{sourceType}</span> — type anything if your column
                differs.
              </p>
            </div>
          )}

          {type === "date" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Granularity</label>
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
          )}

          {type !== "none" && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Daily partitioned by event date, one run per day"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              />
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void saveConfig()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : savedFlash ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : null}
            {savedFlash ? "Saved" : "Save config"}
          </button>
          {type !== "none" && showBackfill ? (
            <span className="text-xs text-slate-500">Save before launching backfills</span>
          ) : null}
        </div>
      </div>

      {showBackfill && type !== "none" && column.trim() ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-5 dark:border-teal-800 dark:bg-teal-900/10">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <RotateCcw className="h-4 w-4 text-teal-600" />
            Backfill launcher
          </h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Select a range of slice values, preview, then launch. Each value creates an independent run with{" "}
            <code className="font-mono">environment=backfill</code> visible in{" "}
            <Link href="/runs" className="text-sky-600 hover:underline dark:text-sky-400">
              Runs
            </Link>
            .
          </p>

          <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-700">
            {isDate && (
              <button
                type="button"
                onClick={() => {
                  setBackfillTab("date");
                  setPreviewReady(false);
                }}
                className={`border-b-2 px-3 py-1.5 text-xs font-medium transition ${
                  backfillTab === "date"
                    ? "border-teal-600 text-teal-700 dark:text-teal-300"
                    : "border-transparent text-slate-500"
                }`}
              >
                Date range
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setBackfillTab("keys");
                setPreviewReady(false);
              }}
              className={`border-b-2 px-3 py-1.5 text-xs font-medium transition ${
                backfillTab === "keys"
                  ? "border-teal-600 text-teal-700 dark:text-teal-300"
                  : "border-transparent text-slate-500"
              }`}
            >
              {isDate ? "Specific values" : "Key values"}
            </button>
          </div>

          {backfillTab === "date" && isDate ? (
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Start</label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => {
                    setDateStart(e.target.value);
                    setPreviewReady(false);
                  }}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">End</label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => {
                    setDateEnd(e.target.value);
                    setPreviewReady(false);
                  }}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-slate-500">Values (one per line)</label>
              <textarea
                value={keyList}
                onChange={(e) => {
                  setKeyList(e.target.value);
                  setPreviewReady(false);
                }}
                rows={4}
                placeholder={isDate ? "2024-01-15\n2024-01-16\n2024-02-01" : "us-east-1\nus-west-2\neu-central-1"}
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
                      {backfillRows.filter((r) => r.selected).length} of {backfillRows.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-xs text-sky-600 hover:underline dark:text-sky-400"
                    >
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
                    <div
                      className={`mt-3 rounded-lg p-3 text-sm ${
                        launchResult.errors.length === 0
                          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200"
                          : "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {launchResult.errors.length === 0 ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        <span className="font-medium">
                          {launchResult.launched} run{launchResult.launched !== 1 ? "s" : ""} launched
                          {launchResult.errors.length > 0
                            ? `, ${launchResult.errors.length} error${launchResult.errors.length !== 1 ? "s" : ""}`
                            : ""}
                        </span>
                      </div>
                      {launchResult.errors.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs">
                          {launchResult.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
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
                      {launching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {launching
                        ? "Launching…"
                        : `Launch ${backfillRows.filter((r) => r.selected).length} backfill run${
                            backfillRows.filter((r) => r.selected).length !== 1 ? "s" : ""
                          }`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
