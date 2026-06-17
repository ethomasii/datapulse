"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Play, XCircle } from "lucide-react";

type RunRow = {
  id: string;
  status: string;
  startedAt: string;
  telemetry?: unknown;
};

const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

export function PipelineRunPanel({ pipelineId }: { pipelineId: string | null }) {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRuns = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/elt/runs?pipelineId=${encodeURIComponent(pipelineId)}&limit=5`,
        { credentials: "same-origin" }
      );
      const data = (await res.json()) as { runs?: RunRow[] };
      setRuns(data.runs ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const latest = runs[0] ?? null;
  const isActive = latest && !TERMINAL.has(latest.status);

  useEffect(() => {
    if (!pipelineId || !isActive) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    pollRef.current = setInterval(() => void loadRuns(), 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pipelineId, isActive, loadRuns]);

  async function triggerRun() {
    if (!pipelineId) return;
    setTriggering(true);
    setError(null);
    try {
      const res = await fetch("/api/elt/runs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId,
          environment: "default",
          status: "pending",
          triggeredBy: "manual",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof data.error === "string" ? data.error : `HTTP ${res.status}`);
      }
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start run");
    } finally {
      setTriggering(false);
    }
  }

  if (!pipelineId) return null;

  const statusIcon =
    latest?.status === "succeeded" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
    ) : latest?.status === "failed" || latest?.status === "cancelled" ? (
      <XCircle className="h-4 w-4 text-red-600" aria-hidden />
    ) : latest ? (
      <Loader2 className="h-4 w-4 animate-spin text-sky-600" aria-hidden />
    ) : null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Run this pipeline</h3>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Managed execution — no gateway setup required.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void triggerRun()}
          disabled={triggering || isActive}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {triggering || isActive ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
          {isActive ? "Running…" : "Run now"}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}

      {latest ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
          {statusIcon}
          <span className="font-medium capitalize">{latest.status}</span>
          <span className="text-slate-400">·</span>
          <span>{new Date(latest.startedAt).toLocaleString()}</span>
          <Link
            href={`/runs?pipeline=${encodeURIComponent(pipelineId)}&run=${encodeURIComponent(latest.id)}`}
            className="font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            View logs →
          </Link>
        </div>
      ) : loading ? (
        <p className="mt-3 text-xs text-slate-500">Loading runs…</p>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">No runs yet — click Run now to start.</p>
      )}
    </div>
  );
}
