import type { PipelineLastRunSummary } from "@/lib/elt/pipeline-assets";

export type AssetFreshness = "fresh" | "stale" | "never_run" | "failed" | "running";

export type AssetFreshnessMeta = {
  freshness: AssetFreshness;
  label: string;
  badgeClass: string;
  detail: string;
};

const FRESH_MS = 24 * 60 * 60 * 1000;

export function computePipelineFreshness(
  lastRun: PipelineLastRunSummary | undefined,
  pipelineEnabled: boolean
): AssetFreshnessMeta {
  if (!lastRun) {
    return {
      freshness: "never_run",
      label: "Never run",
      badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
      detail: pipelineEnabled ? "Pipeline is enabled but has no runs yet." : "No runs recorded.",
    };
  }

  const status = lastRun.status.toLowerCase();
  if (status === "running" || status === "pending") {
    return {
      freshness: "running",
      label: "Running",
      badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
      detail: "A run is in progress.",
    };
  }

  if (status === "failed" || status === "cancelled") {
    return {
      freshness: "failed",
      label: status === "cancelled" ? "Cancelled" : "Failed",
      badgeClass: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
      detail: "Last run did not succeed — check run logs.",
    };
  }

  const ended = lastRun.finishedAt ?? lastRun.startedAt;
  const endedMs = Date.parse(ended);
  if (!Number.isNaN(endedMs) && Date.now() - endedMs <= FRESH_MS) {
    const rows =
      typeof lastRun.rowsLoaded === "number"
        ? ` · ${new Intl.NumberFormat().format(lastRun.rowsLoaded)} rows`
        : "";
    return {
      freshness: "fresh",
      label: "Fresh",
      badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
      detail: `Last successful sync within 24h${rows}.`,
    };
  }

  return {
    freshness: "stale",
    label: "Stale",
    badgeClass: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    detail: "Last success was more than 24 hours ago — consider re-running.",
  };
}
