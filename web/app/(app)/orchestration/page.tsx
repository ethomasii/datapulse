'use client';

import { useState, useEffect } from 'react';
import { CalendarClock, FileJson, PlayCircle, Split, Plus, Trash2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

interface Sensor {
  name: string;
  type: string;
  pipeline_id: string;
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
      const response = await fetch('/api/sensors');
      const data = await response.json();
      setSensors(data.sensors || []);
    } catch (err) {
      setError('Failed to load sensors');
      console.error('Error loading sensors:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkSensors = async () => {
    try {
      setChecking(true);
      setTriggeredSensors([]);
      const response = await fetch('/api/sensors/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      setTriggeredSensors(data.triggeredSensors || []);
    } catch (err) {
      setError('Failed to check sensors');
      console.error('Error checking sensors:', err);
    } finally {
      setChecking(false);
    }
  };

  const deleteSensor = async (sensorName: string) => {
    if (!confirm(`Are you sure you want to delete sensor "${sensorName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/sensors/${sensorName}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (response.ok) {
        await loadSensors();
      } else {
        setError(data.error || 'Failed to delete sensor');
      }
    } catch (err) {
      setError('Failed to delete sensor');
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
    <div className="w-full min-w-0 max-w-6xl space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <Split className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Event-Driven Orchestration</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Sensor Management</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Monitor external systems and automatically trigger pipelines when conditions are met.
          Configure sensors for cloud storage, messaging queues, and file systems.
        </p>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={checkSensors}
            disabled={checking}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            Check Sensors
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            Create Sensor
          </button>
        </div>
        <div className="text-sm text-slate-500">
          {sensors.length} sensor{sensors.length !== 1 ? 's' : ''} configured
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

      {/* Triggered Sensors */}
      {triggeredSensors.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-900 dark:text-amber-100">
            <CheckCircle className="h-5 w-5 text-amber-600" />
            Sensors Triggered ({triggeredSensors.length})
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

      {/* Sensors List */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <FileJson className="h-5 w-5 text-sky-600" />
          Configured Sensors
        </h2>

        {loading ? (
          <div className="mt-4 flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-500">Loading sensors...</span>
          </div>
        ) : sensors.length === 0 ? (
          <div className="mt-4 text-center py-8">
            <Split className="h-12 w-12 text-slate-300 mx-auto" />
            <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">No sensors configured</h3>
            <p className="mt-2 text-slate-500">Create your first sensor to start monitoring external systems.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              <Plus className="h-4 w-4" />
              Create Sensor
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
                      <span className="mt-0.5 block font-mono text-[11px] text-slate-400">{sensor.pipeline_id}</span>
                    </span>
                    <button
                      onClick={() => deleteSensor(sensor.name)}
                      className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete sensor"
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
          Sensor Types
        </h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-300">
          <div>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Cloud Storage:</strong>
            <ul className="mt-1 ml-4 list-disc space-y-1">
              <li>S3 File Count - Monitor AWS S3 bucket file counts</li>
              <li>GCS File Count - Monitor Google Cloud Storage file counts</li>
              <li>ADLS File Count - Monitor Azure Data Lake Storage file counts</li>
            </ul>
          </div>
          <div>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Messaging & Files:</strong>
            <ul className="mt-1 ml-4 list-disc space-y-1">
              <li>CSV Row Count - Monitor CSV file row counts</li>
              <li>Kafka Message Count - Monitor Kafka topic message counts</li>
              <li>SQS Message Count - Monitor AWS SQS queue message counts</li>
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

// Create Sensor Form Component
function CreateSensorForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    pipelineId: '',
    type: '',
    config: {} as Record<string, any>
  });
  const [pipelines, setPipelines] = useState<PipelineOpt[]>([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/elt/pipelines', { credentials: 'same-origin' });
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
    { value: 'gcs_file_count', label: 'GCS File Count', configFields: ['bucket_name', 'threshold', 'blob_pattern'] },
    { value: 'adls_file_count', label: 'ADLS File Count', configFields: ['account_name', 'container_name', 'threshold'] },
    { value: 'csv_row_count', label: 'CSV Row Count', configFields: ['file_path', 'threshold', 'delimiter', 'has_header'] },
    { value: 'kafka_message_count', label: 'Kafka Message Count', configFields: ['bootstrap_servers', 'topic', 'threshold'] },
    { value: 'sqs_message_count', label: 'SQS Message Count', configFields: ['queue_url', 'threshold'] }
  ];

  const selectedType = sensorTypes.find(t => t.value === formData.type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/sensors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to create sensor');
      }
    } catch (err) {
      setError('Failed to create sensor');
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
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Create Sensor</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Sensor Name
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
            {pipelinesLoading ? (
              <div className="rounded-md border border-slate-200 px-3 py-3 text-sm text-slate-500 dark:border-slate-600">
                Loading pipelines…
              </div>
            ) : (
              <select
                value={formData.pipelineId}
                onChange={(e) => setFormData((prev) => ({ ...prev, pipelineId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md dark:border-slate-600 dark:bg-slate-800"
                required
              >
                <option value="">Select a pipeline…</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sourceType} → {p.destinationType})
                    {!p.enabled ? ' — disabled' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Sensor Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md dark:border-slate-600 dark:bg-slate-800"
              required
            >
              <option value="">Select a sensor type...</option>
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
                      {field.replace('_', ' ')}
                    </label>
                    <input
                      type="text"
                      value={formData.config[field] || ''}
                      onChange={(e) => updateConfig(field, e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-slate-300 rounded dark:border-slate-600 dark:bg-slate-800"
                      required={['bucket_name', 'threshold', 'account_name', 'container_name', 'file_path', 'bootstrap_servers', 'topic', 'queue_url'].includes(field)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

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
              {submitting ? 'Creating...' : 'Create Sensor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
