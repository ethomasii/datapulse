import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { HomeAttention } from "@/lib/home/attention";

type Props = HomeAttention;

export function HomeAttentionPanel({ failures24h, failureCount24h, stalePipelines }: Props) {
  const hasIssues = failureCount24h > 0 || stalePipelines.length > 0;

  if (!hasIssues) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <div className="flex flex-wrap items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">All clear</h2>
            <p className="mt-1 text-sm text-emerald-900/90 dark:text-emerald-100/90">
              No failed runs in the last 24 hours and enabled pipelines have synced within the past week.
            </p>
          </div>
          <Link
            href="/observability"
            className="shrink-0 text-sm font-medium text-emerald-800 underline hover:no-underline dark:text-emerald-200"
          >
            View metrics →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 px-5 py-3 dark:border-amber-900/50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden />
          <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">Needs attention</h2>
        </div>
        <Link
          href="/runs?status=failed"
          className="text-xs font-medium text-amber-900 underline hover:no-underline dark:text-amber-200"
        >
          All failed runs →
        </Link>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Failed runs (24h)
            {failureCount24h > failures24h.length ? (
              <span className="ml-1 font-normal normal-case text-amber-700 dark:text-amber-400">
                · {failureCount24h} total
              </span>
            ) : null}
          </h3>
          {failures24h.length === 0 ? (
            <p className="mt-2 text-sm text-amber-900/80 dark:text-amber-100/80">None</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {failures24h.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/runs?run=${encodeURIComponent(r.id)}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-amber-200/80 bg-white/70 px-3 py-2 text-sm hover:bg-white dark:border-amber-900/40 dark:bg-slate-950/40 dark:hover:bg-slate-950/70"
                  >
                    <span className="font-medium text-slate-900 dark:text-white">{r.pipelineName}</span>
                    <span className="text-xs text-amber-800 dark:text-amber-300">failed</span>
                    <span className="w-full text-xs text-slate-500">
                      {r.startedAt.toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Stale syncs ({">"}7 days)
          </h3>
          {stalePipelines.length === 0 ? (
            <p className="mt-2 text-sm text-amber-900/80 dark:text-amber-100/80">None</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {stalePipelines.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/runs?pipeline=${encodeURIComponent(p.id)}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-amber-200/80 bg-white/70 px-3 py-2 text-sm hover:bg-white dark:border-amber-900/40 dark:bg-slate-950/40 dark:hover:bg-slate-950/70"
                  >
                    <span className="font-medium text-slate-900 dark:text-white">{p.name}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300">
                      <Clock className="h-3 w-3" aria-hidden />
                      {p.lastSuccessAt ? "No recent success" : "Never succeeded"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
