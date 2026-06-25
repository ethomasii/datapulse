"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { WorkflowDagEditor } from "@/components/elt/workflow-dag-editor";
import { AppPage, AppPageHeader } from "@/components/layout/app-page";
import type { WorkflowDefinition } from "@/lib/elt/elt-workflow-runner";

type WorkflowRow = {
  id: string;
  name: string;
  enabled: boolean;
  description: string | null;
  definition: WorkflowDefinition;
};

type PipelineOption = { id: string; name: string };

export function WorkflowsClient() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [fromPipelineId, setFromPipelineId] = useState("");
  const [toPipelineId, setToPipelineId] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDef, setEditDef] = useState<WorkflowDefinition>({ nodes: [], edges: [] });
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wfRes, plRes] = await Promise.all([
        fetch("/api/elt/workflows", { credentials: "same-origin" }),
        fetch("/api/elt/pipelines", { credentials: "same-origin" }),
      ]);
      if (wfRes.ok) {
        const data = (await wfRes.json()) as { workflows: WorkflowRow[] };
        setWorkflows(data.workflows ?? []);
      }
      if (plRes.ok) {
        const data = (await plRes.json()) as { pipelines: PipelineOption[] };
        setPipelines(data.pipelines ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createChain(e: React.FormEvent) {
    e.preventDefault();
    if (!fromPipelineId || !toPipelineId) return;
    setBusy(true);
    try {
      const fromName = pipelines.find((p) => p.id === fromPipelineId)?.name ?? "Source";
      const toName = pipelines.find((p) => p.id === toPipelineId)?.name ?? "Downstream";
      const res = await fetch("/api/elt/workflows", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: "Pipeline chain on success",
          definition: {
            nodes: [
              { id: "src", type: "pipeline", pipelineId: fromPipelineId, label: fromName },
              { id: "dst", type: "pipeline", pipelineId: toPipelineId, label: toName },
            ],
            edges: [{ from: "src", to: "dst", on: "success" }],
          },
        }),
      });
      if (res.ok) {
        setName("");
        setFromPipelineId("");
        setToPipelineId("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeWorkflow(id: string) {
    await fetch(`/api/elt/workflows/${id}`, { method: "DELETE", credentials: "same-origin" });
    if (editingId === id) setEditingId(null);
    await load();
  }

  function startEdit(w: WorkflowRow) {
    setEditingId(w.id);
    setEditDef(w.definition ?? { nodes: [], edges: [] });
  }

  async function saveEdit() {
    if (!editingId) return;
    setSavingEdit(true);
    try {
      await fetch(`/api/elt/workflows/${editingId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition: editDef }),
      });
      await load();
    } finally {
      setSavingEdit(false);
    }
  }

  const editingWorkflow = workflows.find((w) => w.id === editingId);

  return (
    <AppPage width="narrow">
      <AppPageHeader
        title="Pipeline chains"
        description={
          <>
            Link pipelines so one run triggers the next on success — separate from building a single pipeline in{" "}
            <Link href="/builder" className="text-sky-600 underline dark:text-sky-400">
              Pipelines
            </Link>{" "}
            or{" "}
            <Link href="/builder?view=canvas" className="text-sky-600 underline dark:text-sky-400">
              Visual canvas
            </Link>
            . See{" "}
            <Link href="/docs/pipelines" className="text-sky-600 underline dark:text-sky-400">
              declarative pipelines
            </Link>{" "}
            and <code className="text-xs">examples/component-routing-table.md</code>.
          </>
        }
      />

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
      ) : (
        <>
          <ul className="space-y-2">
            {workflows.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <button type="button" onClick={() => startEdit(w)} className="min-w-0 flex-1 text-left">
                  <p className="font-medium text-slate-900 dark:text-white">{w.name}</p>
                  <p className="text-xs text-slate-500">
                    {w.definition.nodes?.length ?? 0} nodes · {w.definition.edges?.length ?? 0} edges
                    {!w.enabled ? " · disabled" : ""}
                    {editingId === w.id ? " · editing" : ""}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => void removeWorkflow(w.id)}
                  className="rounded p-1 text-slate-400 hover:text-red-600"
                  aria-label={`Delete ${w.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {workflows.length === 0 ? (
              <li className="text-sm text-slate-500">No workflows — create a pipeline chain below.</li>
            ) : null}
          </ul>

          {editingWorkflow ? (
            <section className="rounded-xl border border-sky-200 bg-white p-5 dark:border-sky-900 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-900 dark:text-white">Edit DAG: {editingWorkflow.name}</h2>
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  <Save className="h-4 w-4" aria-hidden />
                  {savingEdit ? "Saving…" : "Save DAG"}
                </button>
              </div>
              <div className="mt-4">
                <WorkflowDagEditor
                  definition={editDef}
                  pipelines={pipelines}
                  onChange={setEditDef}
                />
              </div>
            </section>
          ) : null}

          <form onSubmit={createChain} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-semibold text-slate-900 dark:text-white">New pipeline chain</h2>
            <div className="mt-4 grid gap-3">
              <label className="block text-sm">
                <span className="font-medium">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">When this pipeline succeeds</span>
                <select
                  value={fromPipelineId}
                  onChange={(e) => setFromPipelineId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
                >
                  <option value="">Select pipeline…</option>
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Run this pipeline next</span>
                <select
                  value={toPipelineId}
                  onChange={(e) => setToPipelineId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
                >
                  <option value="">Select pipeline…</option>
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
                className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Create workflow
              </button>
            </div>
          </form>
        </>
      )}
    </AppPage>
  );
}
