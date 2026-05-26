'use client';

import { useState, useEffect } from 'react';
import { FileJson, Layers, PlayCircle, Split, Plus, Trash2, CheckCircle, AlertCircle, RefreshCw, Waypoints } from "lucide-react";
import Link from "next/link";
import { RelatedLinks } from "@/components/ui/related-links";
import { PipelineSinglePicker } from "@/components/elt/pipeline-pickers";

interface MonitorRow {
  name: string;
  type: string;
  pipeline_id: string;
  pipeline_name: string;
  execution_host: string;
  config: Record<string, unknown>;
  last_check: string | null;
  last_triggered: string | null;
}

interface TriggeredMonitorRow {
  monitorName: string;
  pipelineName: string;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

function normalizeMonitorRow(raw: Record<string, unknown>): MonitorRow | null {
  if (typeof raw.name !== "string" || !raw.name) return null;
  const cfg = raw.config;
  const config =
    cfg && typeof cfg === "object" && !Array.isArray(cfg) ? (cfg as Record<string, unknown>) : {};
  return {
    name: raw.name,
    type: typeof raw.type === "string" ? raw.type : "",
    pipeline_id: typeof raw.pipeline_id === "string" ? raw.pipeline_id : "",
    pipeline_name: typeof raw.pipeline_name === "string" ? raw.pipeline_name : "",
    execution_host: typeof raw.execution_host === "string" ? raw.execution_host : "inherit",
    config,
    last_check: typeof raw.last_check === "string" ? raw.last_check : null,
    last_triggered: typeof raw.last_triggered === "string" ? raw.last_triggered : null,
  };
}

export default function OrchestrationPage() {
  const [monitors, setMonitors] = useState<MonitorRow[]>([]);
  const [pipelineHosts, setPipelineHosts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [triggeredMonitors, setTriggeredMonitors] = useState<TriggeredMonitorRow[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMonitors();
  }, []);

  const loadMonitors = async () => {
    try {
      setLoading(true);
      setError(null);
      const [monRes, plRes] = await Promise.all([
        fetch("/api/monitors", { credentials: "same-origin" }),
        fetch("/api/elt/pipelines", { credentials: "same-origin" }),
      ]);
      const monData = (await monRes.json()) as { monitors?: Record<string, unknown>[]; error?: string };
      if (!monRes.ok) {
        setError(typeof monData.error === "string" ? monData.error : "Failed to load monitors");
        setMonitors([]);
        return;
      }
      const rawList = Array.isArray(monData.monitors) ? monData.monitors : [];
      const next = rawList
        .map((row) => normalizeMonitorRow(row))
        .filter((row): row is MonitorRow => row !== null);
      setMonitors(next);

      if (plRes.ok) {
        const plData = (await plRes.json()) as { pipelines?: { id: string; executionHost: string }[] };
        const hostMap: Record<string, string> = {};
        for (const p of plData.pipelines ?? []) {
          if (p.id) hostMap[p.id] = p.executionHost ?? "inherit";
        }
        setPipelineHosts(hostMap);
      }
    } catch (err) {
      setError("Failed to load monitors");
      console.error("Error loading monitors:", err);
      setMonitors([]);
    } finally {
      setLoading(false);
    }
  };

  const checkMonitors = async () => {
    try {
      setChecking(true);
      setTriggeredMonitors([]);
      const response = await fetch("/api/monitors/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as {
        triggeredMonitors?: TriggeredMonitorRow[];
        error?: string;
      };
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to check monitors");
        return;
      }
      setTriggeredMonitors(data.triggeredMonitors ?? []);
    } catch (err) {
      setError("Failed to check monitors");
      console.error("Error checking monitors:", err);
    } finally {
      setChecking(false);
    }
  };

  const deleteMonitor = async (monitorName: string) => {
    if (!confirm(`Are you sure you want to delete monitor "${monitorName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/monitors/${encodeURIComponent(monitorName)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await response.json()) as { error?: string };

      if (response.ok) {
        await loadMonitors();
      } else {
        setError(data.error || "Failed to delete monitor");
      }
    } catch (err) {
      setError("Failed to delete monitor");
      console.error("Error deleting monitor:", err);
    }
  };

  const getMonitorTypeColor = (type: string) => {
    switch (type) {
      case 's3_file_count': return 'bg-orange-100 text-orange-800';
      case 'sqs_message_count': return 'bg-yellow-100 text-yellow-800';
      case 'gcs_file_arrival': return 'bg-blue-100 text-blue-800';
      case 'gcs_file_count': return 'bg-blue-50 text-blue-700';
      case 'adls_file_count': return 'bg-purple-100 text-purple-800';
      case 'sql_watermark': return 'bg-teal-100 text-teal-800';
      case 'http_change': return 'bg-indigo-100 text-indigo-800';
      case 'kafka_message_count': return 'bg-red-100 text-red-800';
      case 'csv_row_count': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="w-full min-w-0 max-w-6xl mx-auto space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <Split className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Event-Driven Orchestration</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Monitor management</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Watch external systems and automatically trigger pipelines when conditions are met.
          Configure monitors for cloud storage, messaging queues, and file systems.
        </p>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={checkMonitors}
            disabled={checking}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            Check monitors
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            Create monitor
          </button>
        </div>
        <div className="text-sm text-slate-500">
          {monitors.length} monitor{monitors.length !== 1 ? "s" : ""} configured
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Error</span>
          </div>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Triggered monitors (API field: triggeredSensors) */}
      {triggeredMonitors.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-900 dark:text-amber-100">
            <CheckCircle className="h-5 w-5 text-amber-600" />
            Monitors triggered ({triggeredMonitors.length})
          </h2>
          <div className="mt-4 space-y-3">
            {triggeredMonitors.map((row, index) => (
              <div key={index} className="rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-700 dark:bg-amber-900/10">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-amber-900 dark:text-amber-100">{row.monitorName}</span>
                    <span className="mx-2 text-amber-600">→</span>
                    <span className="text-amber-800 dark:text-amber-200">{row.pipelineName}</span>
                  </div>
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {new Date(row.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">{row.message}</p>
                {Object.keys(row.metadata).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-amber-700 dark:text-amber-300">Metadata</summary>
                    <pre className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {JSON.stringify(row.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Monitors list */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <FileJson className="h-5 w-5 text-sky-600" />
          Configured monitors
        </h2>

        {loading ? (
          <div className="mt-4 flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-500">Loading monitors...</span>
          </div>
        ) : monitors.length === 0 ? (
          <div className="mt-4 text-center py-8">
            <Split className="h-12 w-12 text-slate-300 mx-auto" />
            <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">No monitors configured</h3>
            <p className="mt-2 text-slate-500">Create your first monitor to start watching external systems.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              <Plus className="h-4 w-4" />
              Create monitor
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {monitors.map((m) => (
              <div key={m.name} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">{m.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getMonitorTypeColor(m.type)}`}>
                      {m.type.replace(/_/g, " ")}
                    </span>
                    {(() => {
                      const monitorHost = m.execution_host;
                      const pipelineHost = pipelineHosts[m.pipeline_id];
                      const effectiveMonitor = monitorHost === "inherit" ? (pipelineHost ?? "eltpulse_managed") : monitorHost;
                      const effectivePipeline = pipelineHost ?? "eltpulse_managed";
                      if (pipelineHost && effectiveMonitor !== effectivePipeline) {
                        return (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                            title={`Monitor runs on '${effectiveMonitor}' but pipeline runs on '${effectivePipeline}' — they may not share the same execution environment`}
                          >
                            ⚠ host mismatch
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <button
                    onClick={() => deleteMonitor(m.name)}
                    className="shrink-0 p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    title="Delete monitor"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Pipeline links */}
                {m.pipeline_id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Pipeline:</span>
                    <Link
                      href={`/builder?pipeline=${encodeURIComponent(m.pipeline_id)}`}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      {m.pipeline_name || m.pipeline_id}
                    </Link>
                    <Link
                      href={`/runs?pipeline=${encodeURIComponent(m.pipeline_id)}`}
                      className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950/70"
                    >
                      View runs →
                    </Link>
                    <Link
                      href={`/run-slices?pipeline=${encodeURIComponent(m.pipeline_id)}`}
                      className="inline-flex items-center gap-1 rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-950/70"
                    >
                      Slice config →
                    </Link>
                  </div>
                ) : null}

                {/* Status row */}
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Last check:{" "}
                    <span className="text-slate-700 dark:text-slate-300">
                      {m.last_check ? new Date(m.last_check).toLocaleString() : "Never"}
                    </span>
                  </span>
                  <span>
                    Last triggered:{" "}
                    <span className={m.last_triggered ? "font-medium text-sky-700 dark:text-sky-300" : "text-slate-400 dark:text-slate-500"}>
                      {m.last_triggered ? new Date(m.last_triggered).toLocaleString() : "Never"}
                    </span>
                  </span>
                </div>

                {/* Config */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                    Configuration
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                    {Object.entries(m.config)
                      .filter(([k]) => !k.startsWith("eltpulse_") && k !== "auth_credentials")
                      .map(([key, value]) => (
                        <div key={key} className="text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-mono text-slate-500">{key}:</span>{" "}
                          {Array.isArray(value) ? (value as unknown[]).join(", ") : String(value)}
                        </div>
                      ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>

      {showCreateForm && (
        <CreateMonitorForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => {
            setShowCreateForm(false);
            loadMonitors();
          }}
        />
      )}

      {/* Footer */}
      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <PlayCircle className="h-5 w-5 text-slate-600" />
          Monitor types
        </h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600 dark:text-slate-300">
          <div>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Cloud Storage:</strong>
            <ul className="mt-1 ml-4 list-disc space-y-1">
              <li>S3 File Count — trigger when file count crosses a threshold</li>
              <li>GCS File Arrival — trigger when new files matching a regex land in a bucket</li>
              <li>ADLS File Count — Azure Data Lake Storage file counts</li>
            </ul>
          </div>
          <div>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Databases & APIs:</strong>
            <ul className="mt-1 ml-4 list-disc space-y-1">
              <li>SQL Watermark — trigger when new rows appear in a table (tracks updated_at / id)</li>
              <li>HTTP Change — trigger when an API endpoint response changes (hash-based)</li>
            </ul>
          </div>
          <div>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Queues & Files:</strong>
            <ul className="mt-1 ml-4 list-disc space-y-1">
              <li>SQS Message Count — AWS SQS queue depth</li>
              <li>Kafka Message Count — Kafka topic message counts</li>
              <li>CSV Row Count — local CSV row counts (gateway only)</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-sm">
          <Link href="/docs/orchestration" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Documentation
          </Link>
          {" · "}
          <Link href="/roadmap" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Roadmap
          </Link>
        </p>
      </section>

      <RelatedLinks links={[
        { href: "/builder", icon: Layers, label: "Pipelines", desc: "Edit the pipeline a monitor triggers — source, destination, transforms" },
        { href: "/runs", icon: PlayCircle, label: "Runs", desc: "View execution history; filter by pipeline to see monitor-triggered runs" },
        { href: "/run-slices", icon: Split, label: "Run slices", desc: "Configure partition column and values that monitors queue per trigger" },
        { href: "/gateway", icon: Waypoints, label: "Gateway & execution", desc: "Connect your runner or use eltPulse-managed workers" },
      ]} />
    </div>
  );
}

type PipelineOpt = {
  id: string;
  name: string;
  tool: string;
  enabled: boolean;
  sourceType: string;
  destinationType: string;
};

const REQUIRED_FIELDS = new Set([
  'bucket_name', 'threshold', 'account_name', 'container_name',
  'file_path', 'bootstrap_servers', 'topic', 'queue_url',
  'table', 'url',
]);

const FIELD_PLACEHOLDERS: Record<string, string> = {
  bucket_name: 'my-bucket',
  prefix: 'data/incoming/',
  file_pattern: '.*\\.csv$',
  threshold: '1',
  region: 'us-east-1',
  blob_pattern: '*.parquet',
  account_name: 'mystorageaccount',
  container_name: 'raw-data',
  file_path: '/data/export.csv',
  delimiter: ',',
  has_header: 'true',
  bootstrap_servers: 'kafka:9092',
  topic: 'my-topic',
  queue_url: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
  table: 'public.events',
  watermark_column: 'updated_at',
  url: 'https://api.example.com/v1/status',
  json_path: 'data.count',
};

const FIELD_HELP: Record<string, string> = {
  file_pattern: 'Regex matched against the full object key. E.g. .*\\.csv$ for CSV files.',
  watermark_column: 'Column used to detect new rows — typically updated_at or an auto-increment id.',
  json_path: 'Dot-notation path into the JSON response to hash. Leave blank to hash the full body.',
  table: 'Schema-qualified table name, e.g. public.orders.',
};

function CreateMonitorForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    pipelineId: '',
    type: '',
    config: {} as Record<string, any>
  });
  /** One slice value per line (stored as `partition_values` on the monitor). */
  const [slicePartitionValuesText, setSlicePartitionValuesText] = useState("");
  /** Optional override; pipeline saved partition column is used if empty. */
  const [slicePartitionColumn, setSlicePartitionColumn] = useState("");
  const [pipelines, setPipelines] = useState<PipelineOpt[]>([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/elt/pipelines", { credentials: "same-origin" });
        const data = (await res.json()) as { pipelines?: PipelineOpt[] };
        if (!cancelled && res.ok && Array.isArray(data.pipelines)) {
          setPipelines(data.pipelines);
        }
      } catch {
        if (!cancelled) setPipelines([]);
      } finally {
        if (!cancelled) setPipelinesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sensorTypes = [
    { value: 's3_file_count', label: 'S3 File Count', configFields: ['bucket_name', 'threshold', 'prefix', 'region'] },
    { value: 'sqs_message_count', label: 'SQS Message Count', configFields: ['queue_url', 'threshold'] },
    { value: 'gcs_file_arrival', label: 'GCS File Arrival', configFields: ['bucket_name', 'prefix', 'file_pattern'] },
    { value: 'gcs_file_count', label: 'GCS File Count (legacy)', configFields: ['bucket_name', 'threshold', 'blob_pattern'] },
    { value: 'adls_file_count', label: 'ADLS File Count', configFields: ['account_name', 'container_name', 'threshold'] },
    { value: 'sql_watermark', label: 'SQL Watermark', configFields: ['table', 'watermark_column'] },
    { value: 'http_change', label: 'HTTP Change Detection', configFields: ['url', 'json_path'] },
    { value: 'kafka_message_count', label: 'Kafka Message Count', configFields: ['bootstrap_servers', 'topic', 'threshold'] },
    { value: 'csv_row_count', label: 'CSV Row Count', configFields: ['file_path', 'threshold', 'delimiter', 'has_header'] },
  ];

  const selectedType = sensorTypes.find(t => t.value === formData.type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.pipelineId.trim()) {
      setError("Select a pipeline");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const finalConfig = { ...formData.config };
      const lines = slicePartitionValuesText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (lines.length > 0) {
        finalConfig.partition_values = lines;
      } else {
        delete finalConfig.partition_values;
      }
      if (slicePartitionColumn.trim()) {
        finalConfig.partition_column = slicePartitionColumn.trim();
      } else {
        delete finalConfig.partition_column;
      }

      const response = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...formData, config: finalConfig }),
      });

      const data = (await response.json()) as { error?: string };

      if (response.ok) {
        onSuccess();
      } else {
        setError(data.error || "Failed to create monitor");
      }
    } catch (err) {
      setError("Failed to create monitor");
    } finally {
      setSubmitting(false);
    }
  };

  const updateConfig = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value }
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Create monitor</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Monitor name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md dark:border-slate-600 dark:bg-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Pipeline
            </label>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Linked by stable id — renaming the pipeline in the builder does not break this monitor.
            </p>
            <PipelineSinglePicker
              pipelines={pipelines}
              value={formData.pipelineId}
              onChange={(pipelineId) => setFormData((prev) => ({ ...prev, pipelineId }))}
              loading={pipelinesLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Monitor type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md dark:border-slate-600 dark:bg-slate-800"
              required
            >
              <option value="">Select a monitor type...</option>
              {sensorTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {selectedType && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Configuration
              </label>
              <div className="space-y-2">
                {selectedType.configFields.map(field => (
                  <div key={field}>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 capitalize">
                      {field.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="text"
                      value={formData.config[field] as string || ''}
                      onChange={(e) => updateConfig(field, e.target.value)}
                      placeholder={FIELD_PLACEHOLDERS[field] ?? ''}
                      className="w-full px-2 py-1 text-sm border border-slate-300 rounded dark:border-slate-600 dark:bg-slate-800"
                      required={REQUIRED_FIELDS.has(field)}
                    />
                    {FIELD_HELP[field] && (
                      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{FIELD_HELP[field]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/40">
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200">When the monitor fires: slice runs (optional)</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
              If you list values below, eltPulse queues <strong className="font-medium">one pending run per line</strong>{" "}
              with <code className="rounded bg-white px-0.5 font-mono text-[10px] dark:bg-slate-900">partitionValue</code>{" "}
              set for your gateway (same as dlt <code className="font-mono text-[10px]">partition_key</code>). Leave empty
              for a single run with no slice. Partition column defaults from the pipeline&apos;s Run slices config unless
              you override it.
            </p>
            <label className="mt-2 block text-xs text-slate-600 dark:text-slate-400">
              Partition column override (optional)
              <input
                type="text"
                value={slicePartitionColumn}
                onChange={(e) => setSlicePartitionColumn(e.target.value)}
                placeholder="e.g. event_date"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                spellCheck={false}
              />
            </label>
            <label className="mt-2 block text-xs text-slate-600 dark:text-slate-400">
              Partition values (one per line, max 100)
              <textarea
                value={slicePartitionValuesText}
                onChange={(e) => setSlicePartitionValuesText(e.target.value)}
                placeholder={"2024-01-01\n2024-01-02"}
                rows={4}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
                spellCheck={false}
              />
            </label>
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create monitor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
