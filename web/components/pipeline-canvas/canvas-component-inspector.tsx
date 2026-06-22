"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ComponentCatalogAssetPanel } from "@/components/elt/component-catalog-asset-panel";
import { ComponentSchemaForm } from "@/components/elt/component-schema-form";
import { ComponentDataPreview } from "@/components/elt/component-data-preview";
import { RunStepPanel } from "@/components/elt/run-step-panel";
import { OperatorColumnGrid } from "@/components/pipeline-canvas/operator-column-grid";
import { inputTableFromConfig } from "@/lib/elt/pipeline-asset-keys";
import type { NativeComponentField } from "@/lib/elt/native-components";
import { compileTargetLabel } from "@/lib/elt/compile-target-labels";

type ComponentDetail = {
  id: string;
  name: string;
  category: string;
  description: string;
  compileTarget: string;
  compileTargetLabel?: string;
  compileHint: string;
  isNative?: boolean;
  isPackage?: boolean;
  hasCompiler?: boolean;
  compilerTier?: "native" | "category" | "schema" | "none";
  isExecutable?: boolean;
  compilerTierHint?: string;
  packageCatalogId?: string | null;
  monitorPair?: { monitorId: string; pipelineComponentId: string; label: string } | null;
};

type Props = {
  nodeId: string;
  initialData: Record<string, unknown>;
  pipelineId: string;
  readOnly?: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  /** When true, preview is shown in the Lakeflow bottom panel instead. */
  hideInlinePreview?: boolean;
  /** Debounced auto-apply config patches to the canvas node (live preview). */
  autoApply?: boolean;
};

export function CanvasComponentInspector({
  nodeId,
  initialData,
  pipelineId,
  readOnly = false,
  onPatch,
  hideInlinePreview = false,
  autoApply = false,
}: Props) {
  const componentId = String(initialData.componentId ?? "");
  const [detail, setDetail] = useState<ComponentDetail | null>(null);
  const [formFields, setFormFields] = useState<NativeComponentField[]>([]);
  const [config, setConfig] = useState<Record<string, unknown>>(
    (initialData.config as Record<string, unknown>) ?? {}
  );
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [configJson, setConfigJson] = useState(
    JSON.stringify(initialData.config ?? {}, null, 2)
  );
  const [loading, setLoading] = useState(true);
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
        nativeFields: NativeComponentField[] | null;
      };
      setDetail(data.component);
      setFormFields(data.nativeFields ?? []);
    } finally {
      setLoading(false);
    }
  }, [componentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setConfig((initialData.config as Record<string, unknown>) ?? {});
    setConfigJson(JSON.stringify(initialData.config ?? {}, null, 2));
  }, [nodeId, initialData.config]);

  function saveConfig(next: Record<string, unknown>, silent = false) {
    setConfig(next);
    setConfigJson(JSON.stringify(next, null, 2));
    onPatch({ config: { ...next, template_id: componentId } });
    if (!silent) {
      setApplyMsg("Config saved on canvas node — save pipeline to compile into runner code.");
    }
  }

  function queueAutoApply(next: Record<string, unknown>) {
    setConfig(next);
    setConfigJson(JSON.stringify(next, null, 2));
    if (!autoApply || readOnly) return;
    if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    applyTimerRef.current = setTimeout(() => {
      saveConfig(next, true);
    }, 350);
  }

  useEffect(
    () => () => {
      if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    },
    []
  );

  const inputTable = inputTableFromConfig(config);

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
          {compileTargetLabel(detail?.compileTarget ?? "component")}
          {detail?.isExecutable ? (
            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
              {detail?.isPackage ? "PACKAGE" : detail?.isNative ? "NATIVE" : "EXECUTABLE"}
            </span>
          ) : detail?.compilerTier === "category" ? (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              CATEGORY
            </span>
          ) : detail?.compilerTier === "schema" ? (
            <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              SCHEMA
            </span>
          ) : (
            <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              UNSUPPORTED
            </span>
          )}
        </p>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          {detail?.name ?? componentId}
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {detail?.compilerTierHint ?? detail?.compileHint}
        </p>
      </div>

      {detail?.isExecutable ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {detail?.isPackage
            ? `Package compiler from ${detail.packageCatalogId ?? "catalog"}.`
            : "Native compiler — materializes on save and full pipeline run."}
        </p>
      ) : detail?.compilerTier === "category" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Category fallback only — emits ingest hints, basic checks, or a table copy. This is not the
          template&apos;s full logic. Prefer a native component with the same shape, or add
          one to eltpulse-pipeline-components.
        </p>
      ) : detail?.compilerTier === "schema" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Schema template — form fields come from the component catalog. Pipeline save will not run this
          component&apos;s Python unless you add a native compiler or a custom Python step.
        </p>
      ) : null}

      {detail?.monitorPair ? (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
          Sensor pair: triggers{" "}
          <code className="font-mono">{detail.monitorPair.pipelineComponentId}</code> when linked.
        </p>
      ) : null}

      {detail?.isExecutable || detail?.compilerTier === "category" ? (
        <>
          <RunStepPanel
            pipelineId={pipelineId}
            nodeId={nodeId}
            componentId={componentId}
            config={config}
            readOnly={readOnly}
          />
          {!hideInlinePreview ? (
            <ComponentDataPreview
              pipelineId={pipelineId}
              config={config}
              readOnly={readOnly}
              autoLoad
            />
          ) : null}
        </>
      ) : null}

      {!detail?.isExecutable && detail?.compilerTier !== "category" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {detail?.compilerTier === "schema"
            ? "Not executable — discovery and config only. Pick a native component from the executable catalog filter."
            : "Not supported in eltPulse — use Connections, catalog assets, or a native component."}
        </p>
      ) : null}

      <ComponentCatalogAssetPanel
        pipelineId={pipelineId}
        config={config}
        readOnly={readOnly}
        onChange={(next) => (autoApply ? queueAutoApply(next) : saveConfig(next))}
      />

      <OperatorColumnGrid
        pipelineId={pipelineId}
        inputTable={inputTable}
        componentId={componentId}
        config={config}
        readOnly={readOnly}
        onChange={(next) => (autoApply ? queueAutoApply(next) : saveConfig(next))}
      />

      {formFields.length > 0 && !showAdvancedJson ? (
        <>
          <ComponentSchemaForm
            fields={formFields}
            values={config}
            readOnly={readOnly}
            pipelineId={pipelineId}
            onChange={(next) => (autoApply ? queueAutoApply(next) : setConfig(next))}
          />
          {!readOnly && !autoApply ? (
            <button
              type="button"
              onClick={() => saveConfig(config)}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
            >
              Apply config
            </button>
          ) : null}
          {autoApply ? (
            <p className="text-[10px] text-slate-500">Changes apply automatically — preview updates below.</p>
          ) : null}
        </>
      ) : (
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
      )}

      {formFields.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowAdvancedJson((v) => !v)}
          className="text-[11px] text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
        >
          {showAdvancedJson ? "Show form fields" : "Advanced JSON"}
        </button>
      ) : null}

      {showAdvancedJson && formFields.length > 0 && !readOnly ? (
        <button
          type="button"
          onClick={() => {
            try {
              saveConfig(JSON.parse(configJson || "{}") as Record<string, unknown>);
            } catch {
              setApplyMsg("Config must be valid JSON");
            }
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium dark:border-slate-600"
        >
          Apply JSON
        </button>
      ) : null}

      <Link
        href={`/builder?pipeline=${encodeURIComponent(pipelineId)}`}
        className="inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium dark:border-slate-600"
      >
        Open Spec YAML
      </Link>

      {applyMsg ? <p className="text-xs text-slate-600 dark:text-slate-400">{applyMsg}</p> : null}
    </div>
  );
}
