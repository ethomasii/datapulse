"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

type AlertRule = {
  id: string;
  name: string;
  enabled: boolean;
  metric: string;
  operator: string;
  threshold: number;
  windowDays: number;
  pipelineId: string | null;
  lastTriggeredAt: string | null;
};

type PipelineOption = { id: string; name: string };

export function ObservabilityAlertRulesPanel() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [metric, setMetric] = useState<AlertRule["metric"]>("success_rate");
  const [threshold, setThreshold] = useState("95");
  const [pipelineId, setPipelineId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, metricsRes] = await Promise.all([
        fetch("/api/elt/observability/alert-rules", { credentials: "same-origin" }),
        fetch("/api/elt/pipelines/metrics?days=7", { credentials: "same-origin" }),
      ]);
      if (rulesRes.ok) {
        const data = (await rulesRes.json()) as { rules: AlertRule[] };
        setRules(data.rules ?? []);
      }
      if (metricsRes.ok) {
        const data = (await metricsRes.json()) as { filterOptions?: { pipelines: PipelineOption[] } };
        setPipelines(data.filterOptions?.pipelines ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/elt/observability/alert-rules", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          metric,
          operator: metric === "success_rate" ? "lt" : "gt",
          threshold: Number(threshold),
          pipelineId: pipelineId || null,
        }),
      });
      if (res.ok) {
        setName("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeRule(id: string) {
    await fetch(`/api/elt/observability/alert-rules/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    await load();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Alert rules</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Thresholds on pipeline metrics — fires your account run webhook when breached.
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {rules.length === 0 ? (
              <li className="text-sm text-slate-500">No alert rules yet.</li>
            ) : (
              rules.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{r.name}</p>
                    <p className="text-xs text-slate-500">
                      {r.metric} {r.operator} {r.threshold}
                      {r.pipelineId ? ` · pipeline ${r.pipelineId.slice(0, 8)}…` : " · workspace"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeRule(r.id)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    aria-label={`Delete ${r.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))
            )}
          </ul>

          <form onSubmit={createRule} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700 dark:text-slate-300">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Metric</span>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
              >
                <option value="success_rate">Success rate %</option>
                <option value="freshness_hours">Freshness (hours)</option>
                <option value="failed_runs">Failed runs count</option>
                <option value="row_drop_pct">Failure ratio %</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Threshold</span>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700 dark:text-slate-300">Pipeline (optional)</span>
              <select
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
              >
                <option value="">All pipelines (workspace aggregate)</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 sm:col-span-2"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add rule
            </button>
          </form>
        </>
      )}
    </section>
  );
}
