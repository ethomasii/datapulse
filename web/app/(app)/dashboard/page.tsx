import Link from "next/link";
import { ArrowRight, FolderGit2, Layers, Plug, Waypoints } from "lucide-react";
import { requireDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { isManagedExecutionPlane } from "@/lib/elt/execution-plane";

function formatAgentSeen(iso: Date | null, source: string | null) {
  if (!iso) return { line: "No heartbeat yet", sub: "Optional self-hosted or managed worker." };
  const delta = Date.now() - iso.getTime();
  const ago =
    delta < 60_000
      ? `${Math.floor(delta / 1000)}s ago`
      : delta < 3_600_000
        ? `${Math.floor(delta / 60_000)}m ago`
        : `${Math.floor(delta / 3_600_000)}h ago`;
  const who = source === "eltpulse_managed" ? "eltPulse-managed" : "Your gateway";
  return { line: `${who} · ${ago}`, sub: "Heartbeats stored in eltPulse." };
}

export default async function DashboardPage() {
  const user = await requireDbUser();
  const namedAgents = await db.agentToken.findMany({
    where: { userId: user.id, revokedAt: null },
    select: { lastSeenAt: true, lastSeenSource: true },
  });
  type Best = { at: Date; src: string | null };
  let best: Best | null = null;
  for (const t of namedAgents) {
    if (t.lastSeenAt && (!best || t.lastSeenAt > best.at)) {
      best = { at: t.lastSeenAt, src: t.lastSeenSource };
    }
  }
  if (user.agentLastSeenAt && user.agentToken) {
    if (!best || user.agentLastSeenAt > best.at) {
      best = { at: user.agentLastSeenAt, src: user.agentLastSeenSource };
    }
  }
  const agentSeen = formatAgentSeen(best?.at ?? null, best?.src ?? null);
  const executionHint = isManagedExecutionPlane(user.executionPlane)
    ? "Execution: eltPulse-managed (connectivity, ingestion, run metrics)"
    : "Execution: your infrastructure";
  const [pipelineCount, enabledCount] = await Promise.all([
    db.eltPipeline.count({ where: { userId: user.id } }),
    db.eltPipeline.count({ where: { userId: user.id, enabled: true } }),
  ]);

  return (
    <div className="w-full min-w-0 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Overview of your workspace. Signed in as{" "}
          <span className="font-medium text-slate-800 dark:text-slate-200">{user.email}</span>
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Link
          href="/builder"
          className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-700"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              <Layers className="h-5 w-5" aria-hidden />
            </span>
            <ArrowRight
              className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-sky-600 dark:group-hover:text-sky-400"
              aria-hidden
            />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Pipelines</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {pipelineCount === 0
              ? "Create your first source → destination connection."
              : `${pipelineCount} definition${pipelineCount === 1 ? "" : "s"} · ${enabledCount} enabled`}
          </p>
        </Link>

        <Link
          href="/repos"
          className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              <FolderGit2 className="h-5 w-5" aria-hidden />
            </span>
            <ArrowRight
              className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
              aria-hidden
            />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Repositories</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Private repos under eltPulse&apos;s GitHub org—no customer GitHub login required.
          </p>
        </Link>

        <Link
          href="/gateway"
          className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-cyan-800"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200">
              <Waypoints className="h-5 w-5" aria-hidden />
            </span>
            <ArrowRight
              className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-600 dark:group-hover:text-cyan-400"
              aria-hidden
            />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Gateway &amp; execution</h2>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-200">
            {executionHint}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{agentSeen.line}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{agentSeen.sub}</p>
        </Link>

        <Link
          href="/integrations"
          className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-800"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
              <Plug className="h-5 w-5" aria-hidden />
            </span>
            <ArrowRight
              className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600 dark:group-hover:text-violet-400"
              aria-hidden
            />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Integrations</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            How we host code, plus optional connectors—not the primary sign-in path.
          </p>
        </Link>

        <Link
          href="/account"
          className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium uppercase tracking-wide text-slate-500">Account &amp; Settings</span>
            <ArrowRight
              className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 dark:group-hover:text-slate-300"
              aria-hidden
            />
          </div>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Profile, billing, notifications, developers, org, audit.
          </p>
        </Link>
      </section>

      <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">What’s next</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Run history and team activity will surface here. Define syncs in{" "}
          <Link href="/builder" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Pipelines
          </Link>
          ; managed Git storage is described under{" "}
          <Link href="/integrations" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Integrations
          </Link>{" "}
          and{" "}
          <Link href="/repos" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Repositories
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
