import Link from "next/link";
import { requireDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { isManagedExecutionPlane } from "@/lib/elt/execution-plane";
import { effectiveRunTelemetry, formatBytes, formatRows } from "@/lib/elt/run-telemetry";
import { ONBOARDING_STEPS } from "@/lib/onboarding/config";
import { OnboardingChecklist } from "@/components/onboarding/checklist";
import { BarChart } from "@/components/ui/bar-chart";

function dayKey(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

export default async function DashboardPage() {
  const user = await requireDbUser();

  const CHART_DAYS = 14;
  const chartCutoff = new Date();
  chartCutoff.setDate(chartCutoff.getDate() - CHART_DAYS + 1);
  chartCutoff.setHours(0, 0, 0, 0);

  const [pipelineCount, connectionCount, anyRun, activeRuns, recentFinished, chartRuns, namedAgents] =
    await Promise.all([
      db.eltPipeline.count({ where: { userId: user.id } }),
      db.connection.count({ where: { userId: user.id } }),
      db.eltPipelineRun.findFirst({ where: { userId: user.id }, select: { id: true } }),
      db.eltPipelineRun.findMany({
        where: { userId: user.id, status: { in: ["pending", "running"] } },
        orderBy: { startedAt: "desc" },
        take: 8,
        include: { pipeline: { select: { name: true } } },
      }),
      db.eltPipelineRun.findMany({
        where: { userId: user.id, status: { in: ["succeeded", "failed", "cancelled"] } },
        orderBy: { startedAt: "desc" },
        take: 5,
        include: { pipeline: { select: { name: true } } },
      }),
      db.eltPipelineRun.findMany({
        where: { userId: user.id, startedAt: { gte: chartCutoff } },
        orderBy: { startedAt: "asc" },
        select: { startedAt: true, status: true, telemetry: true, logEntries: true },
      }),
      db.agentToken.findMany({
        where: { userId: user.id, revokedAt: null },
        select: { lastSeenAt: true, lastSeenSource: true },
      }),
    ]);

  // Onboarding: compute which steps are done
  const hasGateway =
    !!user.agentToken ||
    namedAgents.length > 0 ||
    isManagedExecutionPlane(user.executionPlane);
  const completedIds = ONBOARDING_STEPS.map((s) => s.id).filter((id) => {
    if (id === "pipeline") return pipelineCount > 0;
    if (id === "connection") return connectionCount > 0;
    if (id === "gateway") return hasGateway;
    if (id === "run") return !!anyRun;
    if (id === "webhook") return !!user.runsWebhookUrl;
    return false;
  });
  const showOnboarding = !user.onboardingDismissedAt;

  // Build per-day aggregates for charts
  const days = lastNDays(CHART_DAYS);
  const runsPerDay = Object.fromEntries(days.map((d) => [d, 0]));
  const rowsPerDay = Object.fromEntries(days.map((d) => [d, 0]));
  for (const r of chartRuns) {
    const key = dayKey(new Date(r.startedAt));
    if (key in runsPerDay) runsPerDay[key]++;
    const tel = effectiveRunTelemetry(r.telemetry as unknown, r.logEntries as unknown);
    if (tel.summary.rowsLoaded !== undefined && key in rowsPerDay) rowsPerDay[key] += tel.summary.rowsLoaded;
  }
  const runsValues = days.map((d) => runsPerDay[d]);
  const rowsValues = days.map((d) => rowsPerDay[d]);
  const hasChartData = chartRuns.length > 0;

  return (
    <div className="w-full min-w-0 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Overview of your workspace. Signed in as{" "}
          <span className="font-medium text-slate-800 dark:text-slate-200">{user.email}</span>
        </p>
      </div>

      {showOnboarding && <OnboardingChecklist completedIds={completedIds} />}

      {/* Activity charts */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Activity — last {CHART_DAYS} days
          </h2>
          <Link href="/runs" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
            All runs →
          </Link>
        </div>

        {!hasChartData ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            No runs in the last {CHART_DAYS} days. Click{" "}
            <strong className="font-medium">Record sample run</strong> on the{" "}
            <Link href="/runs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Runs page
            </Link>{" "}
            to seed data.
          </p>
        ) : (
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <BarChart days={days} values={runsValues} label="Runs per day" barClass="fill-sky-500 dark:fill-sky-400" formatter={(n) => n.toString()} />
            <BarChart days={days} values={rowsValues} label="Rows ingested per day" barClass="fill-emerald-500 dark:fill-emerald-400" formatter={formatRows} />
          </div>
        )}
      </section>

      {/* Runs & telemetry */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Runs &amp; telemetry</h2>
          <Link href="/runs" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
            Open Runs →
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Live <strong className="font-medium text-slate-800 dark:text-slate-200">rows / bytes / progress</strong> when
          your gateway or worker PATCHes <code className="text-xs">/api/agent/runs/:id</code>.
        </p>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Active now</h3>
            {activeRuns.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No pending or running executions.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {activeRuns.map((r) => {
                  const tel = effectiveRunTelemetry(r.telemetry, r.logEntries);
                  const s = tel.summary;
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/runs?run=${encodeURIComponent(r.id)}`}
                        className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                      >
                        <span className="font-medium text-slate-900 dark:text-white">{r.pipeline.name}</span>
                        <span className="capitalize text-slate-600 dark:text-slate-400">{r.status}</span>
                        <span className="w-full font-mono text-xs text-slate-500 dark:text-slate-400">
                          {s.progress !== undefined ? `${Math.round(s.progress)}%` : "—"} ·{" "}
                          {s.rowsLoaded !== undefined ? formatRows(s.rowsLoaded) : "—"} rows ·{" "}
                          {s.bytesLoaded !== undefined ? formatBytes(s.bytesLoaded) : "—"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Recent finished</h3>
            {recentFinished.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No completed runs yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {recentFinished.map((r) => {
                  const tel = effectiveRunTelemetry(r.telemetry, r.logEntries);
                  const s = tel.summary;
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/runs?run=${encodeURIComponent(r.id)}`}
                        className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                      >
                        <span className="font-medium text-slate-900 dark:text-white">{r.pipeline.name}</span>
                        <span className="capitalize text-slate-600 dark:text-slate-400">{r.status}</span>
                        <span className="w-full font-mono text-xs text-slate-500 dark:text-slate-400">
                          {s.rowsLoaded !== undefined ? `${formatRows(s.rowsLoaded)} rows` : "—"} ·{" "}
                          {s.bytesLoaded !== undefined ? formatBytes(s.bytesLoaded) : "—"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
