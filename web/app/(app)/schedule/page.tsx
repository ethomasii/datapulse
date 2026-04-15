'use client';

import { useState, useEffect } from 'react';
import { CalendarClock, Clock, Layers, Play, PlayCircle, Plus, Trash2, CheckCircle, AlertCircle, RefreshCw, Waypoints, Webhook } from "lucide-react";
import Link from "next/link";
import { RelatedLinks } from "@/components/ui/related-links";
import { PipelineMultiPicker } from "@/components/elt/pipeline-pickers";

interface Schedule {
  name: string;
  type: string;
  pipeline_names: string[];
  cron_expression: string;
  timezone: string;
  last_run: string | null;
  next_run: string | null;
}

interface TriggeredSchedule {
  scheduleName: string;
  pipeline: string;
  message: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [triggeredSchedules, setTriggeredSchedules] = useState<TriggeredSchedule[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/schedules');
      const data = await response.json();
      setSchedules(data.schedules || []);
    } catch (err) {
      setError('Failed to load schedules');
      console.error('Error loading schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkSchedules = async () => {
    try {
      setChecking(true);
      setTriggeredSchedules([]);
      const response = await fetch('/api/schedules/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      setTriggeredSchedules(data.triggeredSchedules || []);
    } catch (err) {
      setError('Failed to check schedules');
      console.error('Error checking schedules:', err);
    } finally {
      setChecking(false);
    }
  };

  const deleteSchedule = async (scheduleName: string) => {
    if (!confirm(`Are you sure you want to delete schedule "${scheduleName}"?`)) return;
    try {
      const response = await fetch(`/api/schedules/${scheduleName}`, { method: 'DELETE' });
      const data = await response.json();
      if (response.ok) {
        await loadSchedules();
      } else {
        setError(data.error || 'Failed to delete schedule');
      }
    } catch (err) {
      setError('Failed to delete schedule');
    }
  };

  const getScheduleTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'cronschedule': return 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300';
      case 'intervalschedule': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'dailyschedule': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'weeklyschedule': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const formatScheduleType = (type: string) =>
    type.replace(/Schedule$/i, '').replace(/([A-Z])/g, ' $1').trim() || type;

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : 'Never';

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-violet-600 dark:text-violet-400">
          <CalendarClock className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Time-Based Orchestration</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Schedule Management</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Automate pipeline runs using cron expressions, intervals, daily times, or weekly recurrences.
          Schedules trigger pipelines at specified times without manual intervention.
        </p>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={checkSchedules}
            disabled={checking}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            Check Schedules
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            Create Schedule
          </button>
        </div>
        <div className="text-sm text-slate-500">
          {schedules.length} schedule{schedules.length !== 1 ? 's' : ''} configured
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
          <button onClick={() => setError(null)} className="mt-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400">
            Dismiss
          </button>
        </div>
      )}

      {/* Triggered Schedules */}
      {triggeredSchedules.length > 0 && (
        <section className="rounded-2xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-800 dark:bg-violet-900/20">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-violet-900 dark:text-violet-100">
            <CheckCircle className="h-5 w-5 text-violet-600" />
            Schedules Triggered ({triggeredSchedules.length})
          </h2>
          <div className="mt-4 space-y-3">
            {triggeredSchedules.map((s, i) => (
              <div key={i} className="rounded-lg border border-violet-200 bg-white p-4 dark:border-violet-700 dark:bg-violet-900/10">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-violet-900 dark:text-violet-100">{s.scheduleName}</span>
                    <span className="mx-2 text-violet-600">→</span>
                    <span className="text-violet-800 dark:text-violet-200">{s.pipeline}</span>
                  </div>
                  <span className="text-xs text-violet-600 dark:text-violet-400">
                    {new Date(s.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-violet-800 dark:text-violet-200">{s.message}</p>
                {Object.keys(s.metadata).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-violet-700 dark:text-violet-300">Metadata</summary>
                    <pre className="mt-1 text-xs text-violet-600 dark:text-violet-400">
                      {JSON.stringify(s.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Schedules List */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Clock className="h-5 w-5 text-violet-600" />
          Configured Schedules
        </h2>

        {loading ? (
          <div className="mt-4 flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-500">Loading schedules...</span>
          </div>
        ) : schedules.length === 0 ? (
          <div className="mt-4 text-center py-8">
            <CalendarClock className="h-12 w-12 text-slate-300 mx-auto" />
            <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">No schedules configured</h3>
            <p className="mt-2 text-slate-500">Create your first schedule to automate pipeline runs.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" />
              Create Schedule
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {schedules.map((schedule) => (
              <div key={schedule.name} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-900 dark:text-white">{schedule.name}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScheduleTypeColor(schedule.type)}`}>
                      {formatScheduleType(schedule.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">
                      Pipelines: {(schedule.pipeline_names ?? []).join(', ') || '—'}
                    </span>
                    <button
                      onClick={() => deleteSchedule(schedule.name)}
                      className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete schedule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Cron Expression:</span>
                    <div className="mt-1 font-mono text-slate-600 dark:text-slate-400">{schedule.cron_expression}</div>
                    <div className="mt-1 text-slate-500 dark:text-slate-500">Timezone: {schedule.timezone}</div>
                  </div>
                  <div>
                    <div className="text-slate-600 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Last run: </span>
                      {formatDate(schedule.last_run)}
                    </div>
                    <div className="mt-1 text-slate-600 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Next run: </span>
                      {formatDate(schedule.next_run)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showCreateForm && (
        <CreateScheduleForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => { setShowCreateForm(false); loadSchedules(); }}
        />
      )}

      {/* Schedule Types Reference */}
      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <PlayCircle className="h-5 w-5 text-slate-600" />
          Schedule Types
        </h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-300">
          <div>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Cron:</strong>
            <p className="mt-1 ml-4">Full cron expression (e.g. <code className="font-mono text-xs">0 2 * * *</code>)</p>
            <strong className="font-medium text-slate-800 dark:text-slate-200 mt-3 block">Interval:</strong>
            <p className="mt-1 ml-4">Every N minutes (e.g. every 60 minutes)</p>
          </div>
          <div>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Daily:</strong>
            <p className="mt-1 ml-4">Once per day at a specified hour and minute</p>
            <strong className="font-medium text-slate-800 dark:text-slate-200 mt-3 block">Weekly:</strong>
            <p className="mt-1 ml-4">On selected days of the week at a specified time</p>
          </div>
        </div>
        <p className="mt-4 text-sm">
          <Link href="/docs/orchestration" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
            Documentation
          </Link>
          {" · "}
          <Link href="/roadmap" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
            Roadmap
          </Link>
        </p>
      </section>

      <RelatedLinks links={[
        { href: "/orchestration", icon: Waypoints, label: "Orchestration", desc: "Event-driven sensors that trigger runs on data arrival" },
        { href: "/runs", icon: Play, label: "Runs", desc: "View executions triggered by these schedules" },
        { href: "/builder", icon: Layers, label: "Pipelines", desc: "Define the source → destination connections being scheduled" },
        { href: "/webhooks", icon: Webhook, label: "Webhooks", desc: "Get notified when scheduled runs finish" },
      ]} />
    </div>
  );
}

// ─── Create Schedule Form ───────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type PipelineRow = {
  id: string;
  name: string;
  tool: string;
  enabled: boolean;
  sourceType: string;
  destinationType: string;
};

function CreateScheduleForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(true);
  const [selectedPipelineIds, setSelectedPipelineIds] = useState<string[]>([]);
  const [type, setType] = useState('');
  const [cronExpr, setCronExpr] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState('60');
  const [hour, setHour] = useState('9');
  const [minute, setMinute] = useState('0');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]);
  const [timezone, setTimezone] = useState('UTC');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/elt/pipelines', { credentials: 'same-origin' });
        const data = (await res.json()) as { pipelines?: PipelineRow[] };
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

  const togglePipelineId = (pipelineId: string) => {
    setSelectedPipelineIds((prev) =>
      prev.includes(pipelineId) ? prev.filter((n) => n !== pipelineId) : [...prev, pipelineId].sort()
    );
  };

  const toggleDay = (idx: number) => {
    setDaysOfWeek(prev =>
      prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx].sort()
    );
  };

  const buildConfig = (): Record<string, any> => {
    const base = { timezone };
    switch (type) {
      case 'cron': return { ...base, cron_expression: cronExpr };
      case 'interval': return { ...base, interval_minutes: parseInt(intervalMinutes) };
      case 'daily': return { ...base, hour: parseInt(hour), minute: parseInt(minute) };
      case 'weekly': return { ...base, days_of_week: daysOfWeek, hour: parseInt(hour), minute: parseInt(minute) };
      default: return base;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPipelineIds.length === 0) {
      setError('Select at least one pipeline');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name, pipelineIds: selectedPipelineIds, type, config: buildConfig() })
      });
      const data = await response.json();
      if (response.ok) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to create schedule');
      }
    } catch {
      setError('Failed to create schedule');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Create Schedule</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Schedule Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md dark:border-slate-600 dark:bg-slate-800"
              required
            />
          </div>

          {/* Pipelines — names align with CLI / generated folders; id shown for correlation with runs API */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Pipelines on this schedule
            </label>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Select one or more by stable id. The server resolves the current pipeline name for the CLI. Note: the
              local schedules file still stores names; if you rename a pipeline later, recreate or edit that schedule so
              names stay in sync (monitors in the app use ids and are rename-safe).
            </p>
            <PipelineMultiPicker
              pipelines={pipelines}
              selectedIds={selectedPipelineIds}
              onToggle={togglePipelineId}
              loading={pipelinesLoading}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Schedule Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md dark:border-slate-600 dark:bg-slate-800"
              required
            >
              <option value="">Select a schedule type...</option>
              <option value="cron">Cron — custom cron expression</option>
              <option value="interval">Interval — every N minutes</option>
              <option value="daily">Daily — once per day</option>
              <option value="weekly">Weekly — selected days</option>
            </select>
          </div>

          {/* Timezone (all types) */}
          {type && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                placeholder="UTC"
                className="w-full px-3 py-2 border border-slate-300 rounded-md dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
          )}

          {/* Cron */}
          {type === 'cron' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cron Expression</label>
              <input
                type="text"
                value={cronExpr}
                onChange={e => setCronExpr(e.target.value)}
                placeholder="0 2 * * *"
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono dark:border-slate-600 dark:bg-slate-800"
                required
              />
              <p className="mt-1 text-xs text-slate-500">minute hour day month weekday</p>
            </div>
          )}

          {/* Interval */}
          {type === 'interval' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Interval (minutes)</label>
              <input
                type="number"
                min="1"
                value={intervalMinutes}
                onChange={e => setIntervalMinutes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md dark:border-slate-600 dark:bg-slate-800"
                required
              />
            </div>
          )}

          {/* Daily */}
          {type === 'daily' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hour (0–23)</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={hour}
                  onChange={e => setHour(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md dark:border-slate-600 dark:bg-slate-800"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Minute (0–59)</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minute}
                  onChange={e => setMinute(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md dark:border-slate-600 dark:bg-slate-800"
                />
              </div>
            </div>
          )}

          {/* Weekly */}
          {type === 'weekly' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Days of Week</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`px-3 py-1 rounded text-sm font-medium border transition ${
                        daysOfWeek.includes(idx)
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hour (0–23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={hour}
                    onChange={e => setHour(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md dark:border-slate-600 dark:bg-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Minute (0–59)</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minute}
                    onChange={e => setMinute(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md dark:border-slate-600 dark:bg-slate-800"
                  />
                </div>
              </div>
            </>
          )}

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:text-slate-800 dark:text-slate-400">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
