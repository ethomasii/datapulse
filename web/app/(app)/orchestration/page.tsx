"use client";

import { useState, useEffect } from "react";
import { FileJson, PlayCircle, Split, Plus, Trash2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ELTPULSE_MONITOR_CATALOG } from "@/lib/orchestration/eltpulse-monitor-catalog";
import { connectorMatchesMonitorType, monitorTypeRequiresConnection } from "@/lib/monitors/monitor-types";

interface Sensor {
  name: string;
  type: string;
  pipeline_name: string;
  config: Record<string, any>;
  last_check?: string;
}

interface TriggeredSensor {
  sensorName: string;
  pipelineName: string;
  message: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export default function OrchestrationPage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [triggeredSensors, setTriggeredSensors] = useState<TriggeredSensor[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSensors();
  }, []);

  const loadSensors = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/monitors", { credentials: "same-origin" });
      const text = await response.text();
      let data: { sensors?: Sensor[]; error?: string };
      try {
        data = JSON.parse(text) as { sensors?: Sensor[]; error?: string };
      } catch {
        setError(
          response.ok
            ? "Failed to load monitors"
            : `Monitors request failed (${response.status})`
        );
        setSensors([]);
        return;
      }
      if (!response.ok) {
        setError(data.error || `Failed to load monitors (${response.status})`);
        setSensors([]);
        return;
      }
      setSensors(data.sensors || []);
    } catch (err) {
      setError("Failed to load monitors");
      console.error("Error loading sensors:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkSensors = async () => {
    try {
      setChecking(true);
      setTriggeredSensors([]);
      const response = await fetch("/api/monitors/check", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      setTriggeredSensors(data.triggeredSensors || []);
    } catch (err) {
      setError("Failed to run monitor checks");
      console.error('Error checking sensors:', err);
    } finally {
      setChecking(false);
    }
  };

  const deleteSensor = async (sensorName: string) => {
    if (!confirm(`Are you sure you want to delete monitor "${sensorName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/monitors/${encodeURIComponent(sensorName)}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (response.ok) {
        await loadSensors();
      } else {
        setError(data.error || "Failed to delete monitor");
      }
    } catch (err) {
      setError("Failed to delete monitor");
      console.error('Error deleting sensor:', err);
    }
  };

  const getSensorTypeColor = (type: string) => {
    switch (type) {
      case 's3_file_count': return 'bg-orange-100 text-orange-800';
      case 'gcs_file_count': return 'bg-blue-100 text-blue-800';
      case 'adls_file_count': return 'bg-purple-100 text-purple-800';
      case 'csv_row_count': return 'bg-green-100 text-green-800';
      case 'kafka_message_count': return 'bg-red-100 text-red-800';
      case 'sqs_message_count': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="w-full min-w-0 max-w-3xl space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <Split className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Orchestration</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">eltPulse monitors</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Monitors evaluate conditions outside your pipeline code (new files in a bucket, queue depth, a completed sync)
          and can start a pipeline run when the condition is met. They are a{" "}
          <strong className="font-medium text-slate-800 dark:text-slate-200">eltPulse-native</strong> orchestration
          feature — separate from pipeline definitions in the builder.
        </p>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Because checks run from <strong className="font-medium text-slate-800 dark:text-slate-200">eltPulse&apos;s
          environment</strong> (or a gateway you connect), anything that reads{" "}
          <strong className="font-medium text-slate-800 dark:text-slate-200">your</strong> S3, GCS, ADLS, Kafka, or
          other cloud APIs needs <strong className="font-medium text-slate-800 dark:text-slate-200">credentials you
          supply</strong> — for example a named profile in{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">~/.eltpulse/auth.json</code> (see the
          Python CLI) matched to the connection via{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">credential_profile</code> on the
          connection, or the default credential chain when secrets are already in the process environment.
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Broader schedules, run slices, and run policies are on the{" "}
          <Link href="/roadmap" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            roadmap
          </Link>
          . See also{" "}
          <Link href="/docs/orchestration" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Orchestration (docs)
          </Link>
          .
        </p>
      </div>

      <div
        role="status"
        className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100"
      >
        <strong className="font-medium">Authentication is tied to Connections.</strong> Cloud monitor types require you
        to pick a matching saved connection. The API stores{" "}
        <code className="rounded bg-white/80 px-1 text-xs dark:bg-sky-900/80">auth_credentials</code> (profile name from
        the connection, or <code className="rounded bg-white/80 px-1 text-xs dark:bg-sky-900/80">credential_profile</code>{" "}
        in connection config) plus non-secret hints (region, project, account) for the check subprocess. Put secrets in
        your runner environment or in <code className="rounded bg-white/80 px-1 text-xs dark:bg-sky-900/80">auth.json</code>
        — not in the connection JSON.
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={checkSensors}
            disabled={checking}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} aria-hidden />
            Run checks
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create monitor
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {sensors.length} monitor{sensors.length !== 1 ? "s" : ""} configured
        </p>
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

      {/* Triggered Sensors */}
      {triggeredSensors.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-900 dark:text-amber-100">
            <CheckCircle className="h-5 w-5 text-amber-600" />
            Monitors triggered ({triggeredSensors.length})
          </h2>
          <div className="mt-4 space-y-3">
            {triggeredSensors.map((sensor, index) => (
              <div key={index} className="rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-700 dark:bg-amber-900/10">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-amber-900 dark:text-amber-100">{sensor.sensorName}</span>
                    <span className="mx-2 text-amber-600">→</span>
                    <span className="text-amber-800 dark:text-amber-200">{sensor.pipelineName}</span>
                  </div>
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {new Date(sensor.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">{sensor.message}</p>
                {Object.keys(sensor.metadata).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-amber-700 dark:text-amber-300">Metadata</summary>
                    <pre className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {JSON.stringify(sensor.metadata, null, 2)}
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
        ) : sensors.length === 0 ? (
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
            {sensors.map((sensor) => (
              <div key={sensor.name} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-900 dark:text-white">{sensor.name}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSensorTypeColor(sensor.type)}`}>
                      {sensor.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">
                      Pipeline: {sensor.pipeline_name}
                    </span>
                    <button
                      onClick={() => deleteSensor(sensor.name)}
                      className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete monitor"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Configuration:</span>
                    <div className="mt-1 space-y-1">
                      {Object.entries(sensor.config).map(([key, value]) => (
                        <div key={key} className="text-slate-600 dark:text-slate-400">
                          <span className="font-mono">{key}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Status:</span>
                    <div className="mt-1 text-slate-600 dark:text-slate-400">
                      Last check: {sensor.last_check ? new Date(sensor.last_check).toLocaleString() : 'Never'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Sensor Form Modal */}
      {showCreateForm && (
        <CreateSensorForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => {
            setShowCreateForm(false);
            loadSensors();
          }}
        />
      )}

      {/* Footer */}
      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <PlayCircle className="h-5 w-5 text-slate-600" />
          Planned eltPulse monitor kinds
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          The create form uses a short list wired to the Python CLI today. The catalog is the intended product surface;
          each row will map to credential-backed checks against your systems.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
          {ELTPULSE_MONITOR_CATALOG.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="font-medium text-slate-800 dark:text-slate-200">{s.label}</span>
              <span className="ml-2 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {s.category.replace("_", " ")}
              </span>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.description}</p>
            </li>
          ))}
        </ul>
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
    </div>
  );
}

type ApiConnection = { id: string; name: string; connector: string; connectionType: string };

function CreateSensorForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    pipelineName: "",
    type: "",
    config: {} as Record<string, unknown>,
  });
  const [connectionId, setConnectionId] = useState("");
  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensorTypes = [
    { value: "s3_file_count", label: "S3 file count", configFields: ["bucket_name", "threshold", "prefix", "region"] },
    { value: "gcs_file_count", label: "GCS file count", configFields: ["bucket_name", "threshold", "blob_pattern"] },
    { value: "adls_file_count", label: "ADLS file count", configFields: ["account_name", "container_name", "threshold"] },
    { value: "csv_row_count", label: "CSV row count", configFields: ["file_path", "threshold", "delimiter", "has_header"] },
    { value: "kafka_message_count", label: "Kafka message count", configFields: ["bootstrap_servers", "topic", "threshold"] },
    { value: "sqs_message_count", label: "SQS message count", configFields: ["queue_url", "threshold"] },
  ];

  const selectedType = sensorTypes.find((t) => t.value === formData.type);
  const needsConnection = formData.type ? monitorTypeRequiresConnection(formData.type) : false;
  const matchingConnections = formData.type
    ? connections.filter((c) => connectorMatchesMonitorType(c.connector, formData.type))
    : [];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/elt/connections");
        const data = (await res.json()) as { connections?: ApiConnection[] };
        if (!cancelled && Array.isArray(data.connections)) {
          setConnections(data.connections);
        }
      } catch {
        if (!cancelled) setConnections([]);
      } finally {
        if (!cancelled) setLoadingConnections(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (needsConnection && !connectionId.trim()) {
      setError("Select a connection that matches this monitor type.");
      setSubmitting(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        pipelineName: formData.pipelineName,
        type: formData.type,
        config: formData.config,
      };
      if (needsConnection) payload.connectionId = connectionId.trim();

      const response = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { error?: string };

      if (response.ok) {
        onSuccess();
      } else {
        setError(data.error || "Failed to create monitor");
      }
    } catch {
      setError("Failed to create monitor");
    } finally {
      setSubmitting(false);
    }
  };

  const updateConfig = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 dark:bg-slate-900">
        <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Create monitor</h3>
        <p className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Cloud monitors must be linked to a saved connection. The server records{" "}
          <code className="rounded bg-slate-100 px-1 text-[10px] dark:bg-slate-800">auth_credentials</code> from that
          connection (profile name) for the Python runner. Store secrets in{" "}
          <code className="rounded bg-slate-100 px-1 text-[10px] dark:bg-slate-800">~/.eltpulse/auth.json</code> or your
          process environment — optionally set <code className="rounded bg-slate-100 px-1 text-[10px] dark:bg-slate-800">credential_profile</code>{" "}
          on the connection to override the profile name.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Monitor name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Pipeline name</label>
            <input
              type="text"
              value={formData.pipelineName}
              onChange={(e) => setFormData((prev) => ({ ...prev, pipelineName: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Monitor type</label>
            <select
              value={formData.type}
              onChange={(e) => {
                const t = e.target.value;
                setConnectionId("");
                setFormData((prev) => ({ ...prev, type: t, config: {} }));
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              required
            >
              <option value="">Select a monitor type…</option>
              {sensorTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {selectedType && needsConnection && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Connection (required)
              </label>
              {loadingConnections ? (
                <p className="text-xs text-slate-500">Loading connections…</p>
              ) : matchingConnections.length === 0 ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  No matching connections yet.{" "}
                  <Link href="/connections" className="font-medium text-sky-600 underline dark:text-sky-400">
                    Create one
                  </Link>{" "}
                  with the right connector (e.g. S3 for S3 file count).
                </p>
              ) : (
                <select
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  required
                >
                  <option value="">Select a connection…</option>
                  {matchingConnections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.connector})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {selectedType && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Configuration</label>
              <div className="space-y-2">
                {selectedType.configFields.map((field) => (
                  <div key={field}>
                    <label className="mb-1 block text-xs capitalize text-slate-600 dark:text-slate-400">
                      {field.replace(/_/g, " ")}
                    </label>
                    <input
                      type="text"
                      value={String(formData.config[field] ?? "")}
                      onChange={(e) => updateConfig(field, e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                      required={[
                        "bucket_name",
                        "threshold",
                        "account_name",
                        "container_name",
                        "file_path",
                        "bootstrap_servers",
                        "topic",
                        "queue_url",
                      ].includes(field)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}

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
              disabled={submitting || (needsConnection && (!connectionId || matchingConnections.length === 0))}
              className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create monitor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
