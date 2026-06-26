import Link from "next/link";
import { requireDbUser } from "@/lib/auth/server";
import { getWorkspacePermissions, workspaceResourceUserId } from "@/lib/auth/org-permissions";
import { getMonthlyRowsSynced } from "@/lib/billing/report-usage";
import { pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { effectiveRunTelemetry, formatBytes, formatRows } from "@/lib/elt/run-telemetry";
import { runSubjectLabel } from "@/lib/elt/run-display";
import { loadHomeAttention } from "@/lib/home/attention";
import { ONBOARDING_STEPS } from "@/lib/onboarding/config";
import { OnboardingChecklist } from "@/components/onboarding/checklist";
import { HomeAttentionPanel } from "@/components/home/home-attention-panel";
import { HomeShortcuts } from "@/components/home/home-shortcuts";
import { ExecutionStatusBanner } from "@/components/elt/execution-status-banner";
import { AppPage, AppPageHeader } from "@/components/layout/app-page";
import { getManagedExecutionStatus } from "@/lib/elt/managed-execution-status";
import { resolveUserPlanTier, runHistoryPrismaFilter } from "@/lib/plans/tier-features";
import { loadWorkspaceDefaults } from "@/lib/elt/workspace-default-destination";
import { StarterWarehouseBanner } from "@/components/elt/starter-warehouse-banner";

/** Narrow select so Home works when optional DB columns are not migrated yet. */
const HOME_RUN_LIST = {
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

  const [
    pipelineCount,
    connectionCount,
    destinationCount,
    workspaceDefaults,
    anyRun,
    activeRuns,
    recentFinished,
    namedAgents,
    rowsMonth,
    lastSuccess,
    attention,
  ] = await Promise.all([
    db.eltPipeline.count({ where: ownerWhere }),
    db.connection.count({ where: { userId: { in: ownerIds } } }),
    db.connection.count({
      where: { userId: { in: ownerIds }, connectionType: "destination" },
    }),
    loadWorkspaceDefaults(user.id),
    db.eltPipelineRun.findFirst({ where: { userId: { in: ownerIds } }, select: { id: true } }),
    db.eltPipelineRun.findMany({
      where: { userId: { in: ownerIds }, status: { in: ["pending", "running"] } },
      orderBy: { startedAt: "desc" },
      take: 8,
      select: HOME_RUN_LIST,
    }),
    db.eltPipelineRun.findMany({
      where: {
        userId: { in: ownerIds },
        status: { in: ["succeeded", "failed", "cancelled"] },
        ...(historyFilter ? { AND: [historyFilter] } : {}),
      },
      orderBy: { startedAt: "desc" },
      take: 5,
      select: HOME_RUN_LIST,
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
    loadHomeAttention(ownerIds),
  ]);

  const executionStatus = getManagedExecutionStatus();

  const completedIds = ONBOARDING_STEPS.map((s) => s.id).filter((id) => {
    if (id === "pipeline") return pipelineCount > 0;
    if (id === "connection") {
      return (
        destinationCount > 0 || !!workspaceDefaults.defaultDestinationConnectionId || connectionCount > 0
      );
    }
    if (id === "gateway") return namedAgents.length > 0 || !!user.agentToken;
    if (id === "execution") return executionStatus.readyForRealRuns || namedAgents.length > 0;
    if (id === "run") return !!anyRun;
    if (id === "webhook") return !!user.runsWebhookUrl;
    return false;
  });
  const showOnboarding = !user.onboardingDismissedAt;
  const needsStarterWarehouse =
    !workspaceDefaults.defaultDestinationConnectionId && destinationCount === 0;

  return (
    <AppPage width="wide" className="space-y-10">
      <AppPageHeader
        title="Home"
        description={
          showOnboarding ? (
            <>
              Get your workspace running. Signed in as{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">{user.email}</span>
            </>
          ) : (
            <>
              What needs attention and what&apos;s running now. Trends and breakdowns live on{" "}
              <Link href="/observability" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                Metrics
              </Link>
              .
            </>
          )
        }
      />

      {needsStarterWarehouse ? <StarterWarehouseBanner /> : null}

      {showOnboarding ? (
        <OnboardingChecklist completedIds={completedIds} />
      ) : (
        <HomeAttentionPanel {...attention} />
      )}

      <ExecutionStatusBanner />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Failed runs (24h)</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              attention.failureCount24h > 0
                ? "text-amber-700 dark:text-amber-400"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {attention.failureCount24h}
          </p>
          {attention.failureCount24h > 0 ? (
            <Link href="/runs?status=failed" className="mt-1 inline-block text-xs text-sky-600 hover:underline">
              Investigate →
            </Link>
          ) : (
            <p className="mt-1 text-xs text-slate-500">None in the last day</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Active now</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{activeRuns.length}</p>
          <Link href="/runs" className="mt-1 inline-block text-xs text-sky-600 hover:underline">
            Open runs →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Rows this month</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{rowsMonth.toLocaleString()}</p>
          <Link href="/account/billing" className="mt-1 inline-block text-xs text-sky-600 hover:underline">
            Usage &amp; billing →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Last successful sync</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
            {lastSuccess?.pipeline?.name ?? "—"}
          </p>
          <p className="text-xs text-slate-500">
            {lastSuccess?.finishedAt
              ? new Date(lastSuccess.finishedAt).toLocaleString()
              : "No successful runs yet"}
          </p>
        </div>
      </section>

      {!showOnboarding ? <HomeShortcuts /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Live runs</h2>
          <Link href="/runs" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
            All runs →
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Pending and running executions with live rows, bytes, and progress when your worker reports telemetry.
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
                  const failed = r.status === "failed";
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/runs?run=${encodeURIComponent(r.id)}`}
                        className={`flex flex-wrap items-baseline justify-between gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                          failed
                            ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
                            : "border-slate-100 dark:border-slate-800"
                        }`}
                      >
                        <span className="font-medium text-slate-900 dark:text-white">{runSubjectLabel(r)}</span>
                        <span
                          className={`capitalize ${
                            failed ? "font-medium text-amber-800 dark:text-amber-300" : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {r.status}
                        </span>
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

      {!showOnboarding && pipelineCount > 0 ? (
        <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {pipelineCount} pipeline{pipelineCount !== 1 ? "s" : ""} in this workspace — compare success rates,
            duration, and volume over time on{" "}
            <Link href="/observability" className="font-semibold text-sky-600 hover:underline dark:text-sky-400">
              Metrics
            </Link>
            .
          </p>
        </section>
      ) : null}
    </AppPage>
  );
}
