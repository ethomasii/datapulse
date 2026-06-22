import Link from "next/link";
import { requireDbUser } from "@/lib/auth/server";
import { getWorkspacePermissions, workspaceResourceUserId } from "@/lib/auth/org-permissions";
import { getMonthlyRowsSynced } from "@/lib/billing/report-usage";
import { pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { effectiveRunTelemetry, formatBytes, formatRows } from "@/lib/elt/run-telemetry";
import { runSubjectLabel } from "@/lib/elt/run-display";
import { ONBOARDING_STEPS } from "@/lib/onboarding/config";
import { OnboardingChecklist } from "@/components/onboarding/checklist";
import { ExecutionStatusBanner } from "@/components/elt/execution-status-banner";
import { AppPage, AppPageHeader } from "@/components/layout/app-page";
import { BarChart } from "@/components/ui/bar-chart";
import { getManagedExecutionStatus } from "@/lib/elt/managed-execution-status";
import { resolveUserPlanTier, runHistoryPrismaFilter } from "@/lib/plans/tier-features";

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

/** Narrow select so the dashboard works when optional DB columns (e.g. partition fields) are not migrated yet. */
const DASHBOARD_RUN_LIST = {
  id: true,
  status: true,
  telemetry: true,
  logEntries: true,
  pipeline: { select: { name: true } },
  dbtProject: { select: { name: true } },
} as const;

export default async function DashboardPage() {
  const user = await requireDbUser();
  const perms = await getWorkspacePermissions(user.id);
  const ownerIds = perms.resourceOwnerIds;
  const ownerWhere = pipelineOwnerWhere(ownerIds);
  const resourceOwnerId = workspaceResourceUserId(perms, user.id);
  const tier = await resolveUserPlanTier(resourceOwnerId);
  const historyFilter = runHistoryPrismaFilter(tier);

  const CHART_DAYS = 14;
  const chartCutoff = new Date();
  chartCutoff.setDate(chartCutoff.getDate() - CHART_DAYS + 1);
  chartCutoff.setHours(0, 0, 0, 0);

  const [pipelineCount, connectionCount, anyRun, activeRuns, recentFinished, chartRuns, namedAgents, rowsMonth, lastSuccess] =
    await Promise.all([
      db.eltPipeline.count({ where: ownerWhere }),
      db.connection.count({ where: { userId: { in: ownerIds } } }),
      db.eltPipelineRun.findFirst({ where: { userId: { in: ownerIds } }, select: { id: true } }),
      db.eltPipelineRun.findMany({
        where: { userId: { in: ownerIds }, status: { in: ["pending", "running"] } },
        orderBy: { startedAt: "desc" },
        take: 8,
        select: DASHBOARD_RUN_LIST,
      }),
      db.eltPipelineRun.findMany({
        where: {
          userId: { in: ownerIds },
          status: { in: ["succeeded", "failed", "cancelled"] },
          ...(historyFilter ? { AND: [historyFilter] } : {}),
        },
        orderBy: { startedAt: "desc" },
        take: 5,
        select: DASHBOARD_RUN_LIST,
      }),
      db.eltPipelineRun.findMany({
        where: {
          userId: { in: ownerIds },
          startedAt: { gte: chartCutoff },
          ...(historyFilter ? { AND: [historyFilter] } : {}),
        },
        orderBy: { startedAt: "asc" },
        select: { startedAt: true, status: true, telemetry: true, logEntries: true },
      }),
      db.agentToken.findMany({
        where: { userId: { in: ownerIds }, revokedAt: null },
        select: { lastSeenAt: true, lastSeenSource: true },
      }),
      getMonthlyRowsSynced(ownerIds[0] ?? user.id),
      db.eltPipelineRun.findFirst({
        where: { userId: { in: ownerIds }, status: "succeeded" },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true, pipeline: { select: { name: true } } },
      }),
    ]);

  const executionStatus = getManagedExecutionStatus();

  // Onboarding: compute which steps are done
  const completedIds = ONBOARDING_STEPS.map((s) => s.id).filter((id) => {
    if (id === "pipeline") return pipelineCount > 0;
    if (id === "connection") return connectionCount > 0;
    if (id === "gateway") return namedAgents.length > 0 || !!user.agentToken;
    if (id === "execution") return executionStatus.readyForRealRuns || namedAgents.length > 0;
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
    <AppPage width="wide" className="space-y-10">
      <AppPageHeader
        title="Dashboard"
        description={
          <>
            Overview of your workspace. Signed in as{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">{user.email}</span>
          </>
        }
      />

      {showOnboarding && <OnboardingChecklist completedIds={completedIds} />}

      <ExecutionStatusBanner />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Rows this month</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{rowsMonth.toLocaleString()}</p>
          <Link href="/account/billing" className="mt-1 inline-block text-xs text-sky-600 hover:underline">
            Usage &amp; billing →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Pipelines</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{pipelineCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Last successful sync</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {lastSuccess?.pipeline?.name ?? "—"}
          </p>
          <p className="text-xs text-slate-500">
            {lastSuccess?.finishedAt
              ? new Date(lastSuccess.finishedAt).toLocaleString()
              : "No successful runs yet"}
          </p>
        </div>
      </section>

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
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No runs yet. Start with{" "}
              <Link href="/quick-start" className="font-semibold text-sky-600 hover:underline dark:text-sky-400">
                Quick start
              </Link>{" "}
              to create and run your first pipeline in minutes.
            </p>
          </div>
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
                        <span className="font-medium text-slate-900 dark:text-white">{runSubjectLabel(r)}</span>
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
                        <span className="font-medium text-slate-900 dark:text-white">{runSubjectLabel(r)}</span>
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
    </AppPage>
  );
}
