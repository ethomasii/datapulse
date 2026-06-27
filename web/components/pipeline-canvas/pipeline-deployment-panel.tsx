"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Loader2, Save } from "lucide-react";

type DeploymentRow = {
  id: string;
  slug: string;
  label: string;
  isDefault: boolean;
};

type BindingRow = {
  deploymentId: string;
  deployment: DeploymentRow;
  sourceConnectionId: string | null;
  destinationConnectionId: string | null;
};

type ConnectionOption = {
  id: string;
  name: string;
  connectionType: string;
  connector: string;
};

type Props = {
  pipelineId: string;
  canWrite: boolean;
  onSaved?: () => void;
};

export function PipelineDeploymentPanel({ pipelineId, canWrite, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [deployments, setDeployments] = useState<DeploymentRow[]>([]);
  const [bindings, setBindings] = useState<Record<string, { source: string; dest: string }>>({});
  const [connections, setConnections] = useState<ConnectionOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gitRes, depRes, connRes] = await Promise.all([
        fetch(`/api/elt/pipelines/${pipelineId}/git`, { credentials: "same-origin" }),
        fetch("/api/elt/deployments", { credentials: "same-origin" }),
        fetch("/api/elt/connections", { credentials: "same-origin" }),
      ]);
      const gitData = (await gitRes.json()) as {
        deploymentBindings?: BindingRow[];
      };
      const depData = (await depRes.json()) as { deployments?: DeploymentRow[] };
      const connData = (await connRes.json()) as { connections?: ConnectionOption[] };

      const deps = depData.deployments ?? [];
      setDeployments(deps);
      setConnections(connData.connections ?? []);

      const map: Record<string, { source: string; dest: string }> = {};
      for (const d of deps) {
        map[d.id] = { source: "", dest: "" };
      }
      for (const b of gitData.deploymentBindings ?? []) {
        map[b.deploymentId] = {
          source: b.sourceConnectionId ?? "",
          dest: b.destinationConnectionId ?? "",
        };
      }
      setBindings(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load deployments");
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBindings() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const payload = deployments.map((d) => ({
        deploymentId: d.id,
        sourceConnectionId: bindings[d.id]?.source?.trim() || null,
        destinationConnectionId: bindings[d.id]?.dest?.trim() || null,
      }));
      const res = await fetch(`/api/elt/pipelines/${pipelineId}/git`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_bindings", bindings: payload }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading deployments…
      </p>
    );
  }

  const sources = connections.filter((c) => c.connectionType === "source");
  const dests = connections.filter((c) => c.connectionType === "destination");

  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div>
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          Deployments (connections per environment)
        </h3>
        <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
          Same pipeline definition in Git; pick different source/destination connections for development vs production.
          Scheduled and production runs use the production bindings.
        </p>
      </div>

      {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
      {saved ? <p className="text-[10px] text-emerald-600">Bindings saved.</p> : null}

      <ul className="space-y-2">
        {deployments.map((d) => (
          <li key={d.id} className="rounded border border-slate-100 p-2 dark:border-slate-800">
            <p className="mb-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300">
              {d.label}
              <span className="ml-1 font-normal text-slate-400">({d.slug})</span>
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <label className="block text-[10px] text-slate-500">
                Source
                <select
                  disabled={!canWrite}
                  value={bindings[d.id]?.source ?? ""}
                  onChange={(e) =>
                    setBindings((prev) => ({
                      ...prev,
                      [d.id]: { ...prev[d.id], source: e.target.value, dest: prev[d.id]?.dest ?? "" },
                    }))
                  }
                  className="mt-0.5 block w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">Pipeline default</option>
                  {sources.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.connector})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] text-slate-500">
                Destination
                <select
                  disabled={!canWrite}
                  value={bindings[d.id]?.dest ?? ""}
                  onChange={(e) =>
                    setBindings((prev) => ({
                      ...prev,
                      [d.id]: { source: prev[d.id]?.source ?? "", dest: e.target.value },
                    }))
                  }
                  className="mt-0.5 block w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">Pipeline default</option>
                  {dests.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.connector})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </li>
        ))}
      </ul>

      {canWrite ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveBindings()}
          className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px] font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save deployment bindings
        </button>
      ) : null}
    </section>
  );
}
