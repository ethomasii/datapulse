"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type ComponentDetail = {
  id: string;
  name: string;
  category: string;
  description: string;
  compileTarget: string;
  compileHint: string;
  monitorPair?: { monitorId: string; pipelineComponentId: string; label: string } | null;
};

type Props = {
  nodeId: string;
  initialData: Record<string, unknown>;
  pipelineId: string;
  readOnly?: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
};

export function CanvasComponentInspector({
  nodeId,
  initialData,
  pipelineId,
  readOnly = false,
  onPatch,
}: Props) {
  const componentId = String(initialData.componentId ?? "");
  const [detail, setDetail] = useState<ComponentDetail | null>(null);
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [configJson, setConfigJson] = useState(
    JSON.stringify(initialData.config ?? {}, null, 2)
  );
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!componentId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/elt/components/${encodeURIComponent(componentId)}?includeSchema=1`,
        { credentials: "same-origin" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        component: ComponentDetail;
        schema: Record<string, unknown> | null;
      };
      setDetail(data.component);
      setSchema(data.schema);
    } finally {
      setLoading(false);
    }
  }, [componentId]);

  useEffect(() => {
    void load();
  }, [load]);

  function saveConfig() {
    try {
      const parsed = JSON.parse(configJson || "{}") as Record<string, unknown>;
      onPatch({ config: parsed });
    } catch {
      setApplyMsg("Config must be valid JSON");
    }
  }

  async function applyTemplate() {
    setApplyBusy(true);
    setApplyMsg(null);
    try {
      const res = await fetch("/api/elt/pipelines/declaration?mode=upsert", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          declaration: `# Applied from canvas component ${componentId}\neltpulse_pipeline: 2\nupsert: true\nname: apply_${componentId}\nsource: github\ndestination: "@workspace"\ncomponents:\n  - id: ${componentId}\n    type: custom\n    config:\n      template_id: ${componentId}\n`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : "Apply failed");
      }
      setApplyMsg("Template merged — save canvas to persist spec on this pipeline.");
    } catch (e) {
      setApplyMsg(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplyBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">
          {detail?.compileTarget ?? "component"}
        </p>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          {detail?.name ?? componentId}
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{detail?.compileHint}</p>
      </div>

      {detail?.monitorPair ? (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
          Sensor pair: saves as monitor and triggers{" "}
          <code className="font-mono">{detail.monitorPair.pipelineComponentId}</code> pipeline when linked
          connection matches.
        </p>
      ) : null}

      <label className="block text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">Component config (JSON)</span>
        <textarea
          value={configJson}
          onChange={(e) => setConfigJson(e.target.value)}
          readOnly={readOnly}
          rows={8}
          spellCheck={false}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-950"
        />
      </label>

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveConfig}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
          >
            Update node config
          </button>
          <Link
            href={`/builder?pipeline=${encodeURIComponent(pipelineId)}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium dark:border-slate-600"
          >
            Open Spec YAML
          </Link>
        </div>
      ) : null}

      {schema ? (
        <details className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
          <summary className="cursor-pointer text-xs font-semibold">Schema fields</summary>
          <pre className="mt-2 max-h-40 overflow-auto text-[10px] text-slate-600 dark:text-slate-400">
            {JSON.stringify(schema, null, 2)}
          </pre>
        </details>
      ) : null}

      {applyMsg ? <p className="text-xs text-slate-600">{applyMsg}</p> : null}
    </div>
  );
}
