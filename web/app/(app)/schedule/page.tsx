'use client';

import { useState, useEffect } from 'react';
import {
  CalendarClock,
  Clock,
  Play,
  Waypoints,
  Webhook,
  Pencil,
  RefreshCw,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { pipelineToolLabel } from '@/lib/elt/pipeline-tool-labels';
import Link from 'next/link';
import { RelatedLinks } from '@/components/ui/related-links';
import { AppPage, AppPageHeader } from '@/components/layout/app-page';
import { nextCronRun } from '@/lib/elt/cron-match';
import { formatRunPhaseLabel } from '@/lib/elt/dbt-run-phases';

interface Pipeline {
  id: string;
  name: string;
  tool: string;
  sourceType: string;
  destinationType: string;
  enabled: boolean;
  description?: string;
  updatedAt?: string;
  hasDbt?: boolean;
  scheduleInfo?: { enabled: boolean; cron: string | null; timezone: string };
  dbtScheduleInfo?: { enabled: boolean; cron: string | null; timezone: string; mode: string } | null;
  schedulePhases?: string[];
  dbtSchedulePhases?: string[];
}

export default function SchedulePage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [scheduleOnly, setScheduleOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/elt/pipelines', { credentials: 'same-origin' });
        const data = (await res.json()) as { pipelines?: Pipeline[] };
        if (!cancelled && res.ok && Array.isArray(data.pipelines)) {
          setPipelines(data.pipelines);
        } else if (!cancelled) {
          setError('Failed to load pipelines');
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load pipelines');
          console.error('Error loading pipelines:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduledCount = pipelines.filter(
    (p) =>
      (p.scheduleInfo?.enabled && p.scheduleInfo.cron) ||
      (p.dbtScheduleInfo?.enabled && p.dbtScheduleInfo.cron)
  ).length;

  const filtered = pipelines.filter((p) => {
    if (scheduleOnly && !(p.scheduleInfo?.enabled && p.scheduleInfo.cron) && !(p.dbtScheduleInfo?.enabled && p.dbtScheduleInfo.cron)) return false;
    const q = filter.toLowerCase();
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sourceType?.toLowerCase().includes(q) ||
      p.destinationType?.toLowerCase().includes(q)
    );
  });

  return (
    <AppPage width="default">
      <AppPageHeader
        eyebrow="Time-based orchestration"
        title="Pipeline schedules"
        description="Cron schedules are configured per-pipeline inside the pipeline builder. A Vercel Cron job fires every minute and dispatches any pending runs that are due."
      />

      {/* Execution model info box */}
      <section className="rounded-2xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-800 dark:bg-violet-900/20">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 mt-0.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          <div className="space-y-3 text-sm text-violet-900 dark:text-violet-100">
            <p className="font-semibold text-base">How scheduling works</p>
            <ol className="list-decimal list-inside space-y-2 text-violet-800 dark:text-violet-200">
              <li>
                Open a pipeline in the{' '}
                <Link href="/builder" className="font-medium underline hover:text-violet-600">
                  Builder
                </Link>
                , expand the <strong>Quality</strong> accordion, and set a{' '}
                <strong>Cron schedule</strong> (cron expression, timezone, and whether it is
                enabled). Save the pipeline — the schedule is persisted in the pipeline&apos;s
                workspace YAML via <code className="font-mono text-xs">sourceConfiguration</code>.
              </li>
              <li>
                Vercel Cron calls{' '}
                <code className="font-mono text-xs">/api/cron/pipeline-schedules</code> every minute to
                evaluate due sync and dbt-only schedules, then{' '}
                <code className="font-mono text-xs">/api/cron/managed-worker</code> processes pending runs.
              </li>
              <li>
                Sync schedules create runs with phases{' '}
                <strong>Sync → Load → dbt</strong> when dbt is enabled. Separate dbt-only schedules
                (under <code className="font-mono text-xs">sourceConfiguration.dbt</code>) run transform
                only via <code className="font-mono text-xs">schedule:dbt</code>.
              </li>
              <li>
                Track dispatched runs on the{' '}
                <Link href="/runs" className="font-medium underline hover:text-violet-600">
                  Runs
                </Link>{' '}
                page.
              </li>
            </ol>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-mono text-violet-700 dark:text-violet-300">
              <span className="rounded bg-violet-100 px-2 py-1 dark:bg-violet-900/40">Vercel Cron (every minute)</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="rounded bg-violet-100 px-2 py-1 dark:bg-violet-900/40">/api/cron/pipeline-schedules</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="rounded bg-violet-100 px-2 py-1 dark:bg-violet-900/40">enqueue due sync / dbt runs</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="rounded bg-violet-100 px-2 py-1 dark:bg-violet-900/40">dispatches to gateway / managed worker</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline list */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Clock className="h-5 w-5 text-violet-600" aria-hidden />
            All Pipelines
            {scheduledCount > 0 && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                {scheduledCount} scheduled
              </span>
            )}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={scheduleOnly}
                onChange={(e) => setScheduleOnly(e.target.checked)}
                className="rounded"
              />
              Scheduled only
            </label>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name or connector…"
              className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
            />
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                fetch('/api/elt/pipelines', { credentials: 'same-origin' })
                  .then((r) => r.json())
                  .then((d) => {
                    if (Array.isArray(d.pipelines)) setPipelines(d.pipelines);
                    else setError('Failed to refresh pipelines');
                  })
                  .catch(() => setError('Failed to refresh pipelines'))
                  .finally(() => setLoading(false));
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Refresh pipeline list"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
          </div>
        </div>

        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          To view or change a pipeline&apos;s cron schedule, click{' '}
          <strong>Edit schedule</strong> — it opens the builder where you can set the cron
          expression in the Quality accordion.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6 flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            <span className="ml-3 text-slate-500">Loading pipelines…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center py-12 text-center">
            <CalendarClock className="h-12 w-12 text-slate-300 dark:text-slate-600" />
            <h3 className="mt-4 text-base font-medium text-slate-900 dark:text-white">
              {filter ? 'No pipelines match your filter' : 'No pipelines found'}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {filter
                ? 'Try a different search term.'
                : 'Create a pipeline in the Builder, then set a cron schedule in the Quality accordion.'}
            </p>
            {!filter && (
              <Link
                href="/builder"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
              >
                <Layers className="h-4 w-4" aria-hidden />
                Go to Builder
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((pipeline) => (
              <div
                key={pipeline.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-slate-900 dark:text-white">
                      {pipeline.name}
                    </span>
                    {pipeline.scheduleInfo?.enabled && pipeline.scheduleInfo.cron ? (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                          <Clock className="h-3 w-3" aria-hidden />
                          {pipeline.scheduleInfo.cron}
                          {pipeline.scheduleInfo.timezone !== 'UTC' ? ` · ${pipeline.scheduleInfo.timezone}` : ''}
                        </span>
                        {(() => {
                          const next = nextCronRun(pipeline.scheduleInfo!.cron!, pipeline.scheduleInfo!.timezone);
                          return next ? (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Next: <span className="font-medium text-slate-700 dark:text-slate-200">{next}</span>
                            </span>
                          ) : null;
                        })()}
                      </>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        no sync schedule
                      </span>
                    )}
                    {pipeline.dbtScheduleInfo?.enabled && pipeline.dbtScheduleInfo.cron ? (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2 py-0.5 text-xs font-semibold text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200">
                          dbt {pipeline.dbtScheduleInfo.cron}
                          {pipeline.dbtScheduleInfo.timezone !== 'UTC'
                            ? ` · ${pipeline.dbtScheduleInfo.timezone}`
                            : ''}
                        </span>
                        {(() => {
                          const next = nextCronRun(
                            pipeline.dbtScheduleInfo!.cron!,
                            pipeline.dbtScheduleInfo!.timezone
                          );
                          return next ? (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              dbt next:{' '}
                              <span className="font-medium text-slate-700 dark:text-slate-200">{next}</span>
                            </span>
                          ) : null;
                        })()}
                      </>
                    ) : pipeline.hasDbt ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        dbt: follows sync
                      </span>
                    ) : null}
                    {!pipeline.enabled && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        pipeline disabled
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <span className="truncate">{pipeline.sourceType || '—'}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">{pipeline.destinationType || '—'}</span>
                    {pipeline.tool && (
                      <>
                        <span className="mx-1 text-slate-300 dark:text-slate-700">·</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">
                          {pipelineToolLabel(pipeline.tool)}
                        </span>
                      </>
                    )}
                  </div>
                  {pipeline.schedulePhases?.length ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Sync run phases:{' '}
                      {pipeline.schedulePhases.map((p) => formatRunPhaseLabel(p)).join(' → ')}
                      {pipeline.dbtSchedulePhases &&
                      pipeline.dbtScheduleInfo?.mode === 'dbt_only' &&
                      pipeline.dbtScheduleInfo.enabled ? (
                        <>
                          {' '}
                          · dbt-only:{' '}
                          {pipeline.dbtSchedulePhases.map((p) => formatRunPhaseLabel(p)).join(' → ')}
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {pipeline.description && (
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                      {pipeline.description}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  <Link
                    href={`/builder?pipeline=${pipeline.id}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-300 dark:hover:bg-violet-900/40"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit schedule
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p className="mt-4 text-right text-xs text-slate-400 dark:text-slate-600">
            {filtered.length} pipeline{filtered.length !== 1 ? 's' : ''}
            {filter ? ` matching "${filter}"` : ' total'}
          </p>
        )}
      </section>

      {/* How-it-works reference card */}
      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
          <CalendarClock className="h-5 w-5 text-slate-500" aria-hidden />
          Where to go next
        </h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex items-start gap-2">
            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
            <span>
              <Link href="/builder" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
                Pipeline Builder
              </Link>{' '}
              — set a cron schedule on any pipeline (Quality accordion → Cron schedule)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Play className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
            <span>
              <Link href="/runs" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
                Runs
              </Link>{' '}
              — see executions dispatched by the Vercel Cron job
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Waypoints className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
            <span>
              <Link href="/orchestration" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
                Orchestration
              </Link>{' '}
              — event-based triggers (data-arrival sensors) instead of time-based schedules
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Webhook className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
            <span>
              <Link href="/webhooks" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
                Webhooks
              </Link>{' '}
              — incoming webhook triggers to kick off a pipeline run on demand
            </span>
          </li>
        </ul>
      </section>

      <RelatedLinks
        links={[
          { href: '/orchestration', icon: Waypoints, label: 'Orchestration', desc: 'Event-driven sensors that trigger runs on data arrival' },
          { href: '/runs', icon: Play, label: 'Runs', desc: 'View executions triggered by scheduled cron jobs' },
          { href: '/builder', icon: Layers, label: 'Pipelines', desc: 'Set a cron schedule per pipeline in the builder' },
          { href: '/webhooks', icon: Webhook, label: 'Webhooks', desc: 'Incoming webhook triggers for on-demand pipeline runs' },
        ]}
      />
    </AppPage>
  );
}
