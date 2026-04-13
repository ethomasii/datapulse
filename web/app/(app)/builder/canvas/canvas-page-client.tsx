"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Edge, Node } from "@xyflow/react";
import { Loader2, Plus } from "lucide-react";
import { CopyEnvButton } from "@/components/elt/copy-env-button";
import { EltLoadingState } from "@/components/elt/elt-loading-state";
import { FormAccordion } from "@/components/elt/form-accordion";
import { GuidedDestinationBlock } from "@/components/elt/guided-destination-block";
import { GuidedSourceBlock } from "@/components/elt/guided-source-block";
import { CanvasTransformInspector } from "@/components/pipeline-canvas/canvas-transform-inspector";
import {
  type CanvasInspectorFocus,
  type PipelineCanvasControl,
  PipelineCanvas,
} from "@/components/pipeline-canvas/pipeline-canvas";
import { DESTINATION_GROUPS, SOURCE_GROUPS } from "@/lib/elt/catalog";
import {
  emptyConnectionValuesForTypes,
  extractConnectionValues,
  mergeConnectionStrings,
  sanitizeCredentialsForPersistence,
} from "@/lib/elt/credential-payload";
import {
  getDestinationCredentials,
  getSourceConfigurationFields,
  getSourceCredentials,
} from "@/lib/elt/credentials-catalog";
import {
  getCanvasFromSourceConfig,
  stripCanvasFromSourceConfig,
} from "@/lib/elt/canvas-source-config";
import { chooseTool } from "@/lib/elt/choose-tool";
import { enrichTransformNodesFromDltDbt } from "@/lib/elt/dbt-canvas";
import { attachCanvasToSourceConfiguration } from "@/lib/elt/merge-canvas-into-source-config";
import { minimalSourceConfigurationForNewPipeline } from "@/lib/elt/minimal-source-configuration";
import { ensureGithubReposForForm } from "@/lib/elt/normalize-source-configuration";
import clsx from "clsx";

type PipelineRow = { id: string; name: string };

function pickConnectionSubset(values: Record<string, string>, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = values[k] ?? "";
  return out;
}

export function CanvasPageClient() {
  const searchParams = useSearchParams();
  /** Ref avoids recreating fetch callbacks when `useSearchParams()` identity changes every render (Next.js). */
  const pipelineFromUrlRef = useRef<string | null>(null);
  pipelineFromUrlRef.current = searchParams.get("pipeline");
  const pipelineFromUrl = pipelineFromUrlRef.current;

  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadedGraph, setLoadedGraph] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [loadedSig, setLoadedSig] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pipelineSourceType, setPipelineSourceType] = useState("");
  const [pipelineDestinationType, setPipelineDestinationType] = useState("");
  /** Resolved runner: dlt emits post-load dbt in Python; sling does not. */
  const [pipelineTool, setPipelineTool] = useState<"dlt" | "sling">("dlt");
  const [bindingsBusy, setBindingsBusy] = useState(false);
  const [bindingsError, setBindingsError] = useState<string | null>(null);

  /** Last full `source_configuration` from the server (includes `canvas`). */
  const lastFullSourceConfigRef = useRef<Record<string, unknown>>({});
  const [sourceConfigText, setSourceConfigText] = useState("");
  const [sourceConfigError, setSourceConfigError] = useState<string | null>(null);
  const [sourceConfigSaving, setSourceConfigSaving] = useState(false);
  /** Guided form state (same model as /builder). */
  const [sourceCfg, setSourceCfg] = useState<Record<string, unknown>>({});
  const [connectionValues, setConnectionValues] = useState<Record<string, string>>({});
  /** When the catalog has no source schema, connector fields are edited as JSON. */
  const [connectorJson, setConnectorJson] = useState("{}");
  const [advancedJsonDirty, setAdvancedJsonDirty] = useState(false);
  const [showNewPipelineForm, setShowNewPipelineForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSourceType, setNewSourceType] = useState("github");
  const [newDestinationType, setNewDestinationType] = useState("duckdb");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const graphAbortRef = useRef<AbortController | null>(null);

  const schemaFields = useMemo(
    () => getSourceConfigurationFields(pipelineSourceType || "github"),
    [pipelineSourceType]
  );

  const sourceEnvValues = useMemo(
    () =>
      pickConnectionSubset(
        connectionValues,
        getSourceCredentials(pipelineSourceType || "github").map((f) => f.key)
      ),
    [connectionValues, pipelineSourceType]
  );

  const destinationEnvValues = useMemo(
    () =>
      pickConnectionSubset(
        connectionValues,
        getDestinationCredentials(pipelineDestinationType || "duckdb").map((f) => f.key)
      ),
    [connectionValues, pipelineDestinationType]
  );

  const canvasControlRef = useRef<PipelineCanvasControl | null>(null);
  const [inspectorFocus, setInspectorFocus] = useState<CanvasInspectorFocus>({ kind: "none" });

  useEffect(() => {
    setInspectorFocus({ kind: "none" });
  }, [selectedId]);

  const patchConnection = useCallback((key: string, value: string) => {
    setConnectionValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const hydrateFormFromSourceConfig = useCallback(
    (cfg: Record<string, unknown>, st: string, dt: string) => {
      const noCanvas = stripCanvasFromSourceConfig(cfg);
      const { core, connection } = extractConnectionValues(noCanvas, st, dt);
      setSourceCfg(ensureGithubReposForForm(core));
      setConnectionValues({
        ...emptyConnectionValuesForTypes(st, dt),
        ...connection,
      });
      const fields = getSourceConfigurationFields(st);
      setConnectorJson(fields.length === 0 ? JSON.stringify(core, null, 2) : "{}");
      setAdvancedJsonDirty(false);
    },
    []
  );

  const buildBaseSourceConfiguration = useCallback((): Record<string, unknown> => {
    const st = pipelineSourceType || "github";
    const fields = getSourceConfigurationFields(st);
    if (fields.length > 0) {
      return mergeConnectionStrings({ ...sourceCfg }, connectionValues);
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(connectorJson.trim() || "{}") as Record<string, unknown>;
    } catch {
      throw new Error("Connector JSON must be valid");
    }
    const base = { ...parsed };
    const so = sourceCfg.schema_override;
    if (typeof so === "string" && so.trim()) base.schema_override = so.trim();
    else delete base.schema_override;
    const di = sourceCfg.destination_instance;
    if (typeof di === "string" && di.trim()) base.destination_instance = di.trim();
    else delete base.destination_instance;
    return mergeConnectionStrings(base, connectionValues);
  }, [pipelineSourceType, sourceCfg, connectionValues, connectorJson]);

  useEffect(() => {
    if (advancedJsonDirty) return;
    const st = pipelineSourceType || "github";
    const fields = getSourceConfigurationFields(st);
    try {
      let merged: Record<string, unknown>;
      if (fields.length > 0) {
        merged = mergeConnectionStrings({ ...sourceCfg }, connectionValues);
      } else {
        const p = JSON.parse(connectorJson.trim() || "{}") as Record<string, unknown>;
        merged = { ...p };
        const so = sourceCfg.schema_override;
        if (typeof so === "string" && so.trim()) merged.schema_override = so.trim();
        else delete merged.schema_override;
        const di = sourceCfg.destination_instance;
        if (typeof di === "string" && di.trim()) merged.destination_instance = di.trim();
        else delete merged.destination_instance;
        merged = mergeConnectionStrings(merged, connectionValues);
      }
      setSourceConfigText(JSON.stringify(merged, null, 2));
    } catch {
      /* invalid connector JSON mid-edit */
    }
  }, [
    sourceCfg,
    connectionValues,
    connectorJson,
    pipelineSourceType,
    pipelineDestinationType,
    advancedJsonDirty,
  ]);

  const loadPipelines = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch("/api/elt/pipelines", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      const rows = (data.pipelines ?? []) as PipelineRow[];
      setPipelines(rows);
      const fromUrl = pipelineFromUrlRef.current;
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        if (fromUrl && rows.some((r) => r.id === fromUrl)) return fromUrl;
        return rows[0]?.id ?? "";
      });
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPipelines();
  }, [loadPipelines]);

  const loadPipelineGraph = useCallback(async (id: string) => {
    if (!id) {
      graphAbortRef.current?.abort();
      graphAbortRef.current = null;
      setLoadedGraph(null);
      setLoadedSig("");
      setDetailLoading(false);
      return;
    }
    graphAbortRef.current?.abort();
    const ac = new AbortController();
    graphAbortRef.current = ac;
    setDetailLoading(true);
    setSaveError(null);
    setBindingsError(null);
      setPipelineSourceType("");
      setPipelineDestinationType("");
      setPipelineTool("dlt");
      setLoadedGraph(null);
    setLoadedSig("loading");
    setSourceConfigText("");
    setSourceConfigError(null);
    lastFullSourceConfigRef.current = {};
    try {
      const res = await fetch(`/api/elt/pipelines/${id}`, {
        signal: ac.signal,
        credentials: "same-origin",
      });
      if (!res.ok) {
        let msg = `Could not load pipeline (${res.status})`;
        try {
          const errBody = (await res.json()) as { error?: unknown };
          if (typeof errBody.error === "string") msg = errBody.error;
          else if (errBody.error && typeof errBody.error === "object") {
            msg = `${msg}: ${JSON.stringify(errBody.error)}`;
          }
        } catch {
          /* ignore non-JSON error bodies */
        }
        throw new Error(msg);
      }
      const data = await res.json();
      const row = data.pipeline as { sourceType?: string; destinationType?: string; tool?: string };
      setPipelineSourceType(typeof row.sourceType === "string" ? row.sourceType : "");
      setPipelineDestinationType(typeof row.destinationType === "string" ? row.destinationType : "");
      const st0 = typeof row.sourceType === "string" ? row.sourceType : "github";
      const dt0 = typeof row.destinationType === "string" ? row.destinationType : "duckdb";
      const t = row.tool;
      setPipelineTool(t === "dlt" || t === "sling" ? t : chooseTool(st0, dt0));
      const cfg = (data.pipeline.sourceConfiguration ?? {}) as Record<string, unknown>;
      lastFullSourceConfigRef.current = { ...cfg };
      const st = typeof row.sourceType === "string" ? row.sourceType : "github";
      const dt = typeof row.destinationType === "string" ? row.destinationType : "duckdb";
      hydrateFormFromSourceConfig(cfg, st, dt);
      const canvas = getCanvasFromSourceConfig(cfg);
      if (canvas && Array.isArray(canvas.nodes) && Array.isArray(canvas.edges)) {
        const rawDbt = cfg.dlt_dbt;
        const dbtObj =
          rawDbt && typeof rawDbt === "object" && !Array.isArray(rawDbt) ? (rawDbt as Record<string, unknown>) : null;
        const nodes = enrichTransformNodesFromDltDbt(canvas.nodes as Node[], dbtObj);
        const g = { nodes, edges: canvas.edges as Edge[] };
        setLoadedGraph(g);
        setLoadedSig(JSON.stringify({ nodes: g.nodes, edges: g.edges }));
      } else {
        setLoadedGraph(null);
        setLoadedSig("demo");
      }
    } catch (e) {
      const aborted =
        (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError") ||
        (e instanceof Error && e.name === "AbortError");
      if (aborted) return;
      setLoadedGraph(null);
      setLoadedSig("demo");
      setSaveError(e instanceof Error ? e.message : "Failed to load pipeline");
    } finally {
      if (graphAbortRef.current === ac) {
        setDetailLoading(false);
        graphAbortRef.current = null;
      }
    }
  }, [hydrateFormFromSourceConfig]);

  useEffect(() => {
    if (selectedId) void loadPipelineGraph(selectedId);
  }, [selectedId, loadPipelineGraph]);

  const patchPipelineBindings = useCallback(
    async (patch: { sourceType?: string; destinationType?: string }) => {
      if (!selectedId) return;
      setBindingsBusy(true);
      setBindingsError(null);
      try {
        const res = await fetch(`/api/elt/pipelines/${selectedId}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: unknown;
          pipeline?: {
            sourceType?: string;
            destinationType?: string;
            sourceConfiguration?: Record<string, unknown>;
          };
        };
        if (!res.ok) {
          const err = data.error;
          let msg = "Could not update source or destination";
          if (typeof err === "string") msg = err;
          else if (err && typeof err === "object" && !Array.isArray(err)) {
            const parts: string[] = [];
            for (const [k, v] of Object.entries(err as Record<string, unknown>)) {
              if (Array.isArray(v)) parts.push(...v.map((x) => `${k}: ${String(x)}`));
              else parts.push(`${k}: ${String(v)}`);
            }
            if (parts.length) msg = parts.join(" · ");
          }
          throw new Error(msg);
        }
        if (data.pipeline) {
          const prow = data.pipeline as { tool?: string; sourceType?: string; destinationType?: string };
          if (typeof prow.tool === "string" && (prow.tool === "dlt" || prow.tool === "sling")) {
            setPipelineTool(prow.tool);
          } else if (typeof prow.sourceType === "string" && typeof prow.destinationType === "string") {
            setPipelineTool(chooseTool(prow.sourceType, prow.destinationType));
          }
          if (typeof data.pipeline.sourceType === "string") {
            setPipelineSourceType(data.pipeline.sourceType);
          }
          if (typeof data.pipeline.destinationType === "string") {
            setPipelineDestinationType(data.pipeline.destinationType);
          }
          const sc = data.pipeline.sourceConfiguration as Record<string, unknown> | undefined;
          if (sc && typeof sc === "object") {
            lastFullSourceConfigRef.current = { ...sc };
            const st =
              typeof data.pipeline.sourceType === "string"
                ? data.pipeline.sourceType
                : pipelineSourceType || "github";
            const dt =
              typeof data.pipeline.destinationType === "string"
                ? data.pipeline.destinationType
                : pipelineDestinationType || "duckdb";
            hydrateFormFromSourceConfig(sc, st, dt);
          }
        }
      } catch (e) {
        setBindingsError(e instanceof Error ? e.message : "Update failed");
      } finally {
        setBindingsBusy(false);
      }
    },
    [selectedId, pipelineSourceType, pipelineDestinationType, hydrateFormFromSourceConfig]
  );

  function formatCreateApiError(data: Record<string, unknown>): string {
    const err = data.error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && !Array.isArray(err)) {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(err as Record<string, unknown>)) {
        if (Array.isArray(v)) parts.push(...v.map((x) => `${k}: ${String(x)}`));
        else parts.push(`${k}: ${String(v)}`);
      }
      if (parts.length) return parts.join(" · ");
    }
    return "Could not create pipeline";
  }

  async function handleCreatePipeline(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setCreateError("Enter a pipeline name (e.g. my_pipeline).");
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    try {
      const sourceConfiguration = minimalSourceConfigurationForNewPipeline(newSourceType);
      const res = await fetch("/api/elt/pipelines", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sourceType: newSourceType,
          destinationType: newDestinationType,
          tool: "auto",
          sourceConfiguration,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(formatCreateApiError(data));
      }
      const pipeline = data.pipeline as { id?: string } | undefined;
      const newId = pipeline?.id;
      setShowNewPipelineForm(false);
      setNewName("");
      await loadPipelines();
      if (newId) setSelectedId(newId);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreateBusy(false);
    }
  }

  /** Client navigations to `?pipeline=` after the list is already loaded. */
  useEffect(() => {
    if (!pipelineFromUrl || pipelines.length === 0) return;
    if (!pipelines.some((p) => p.id === pipelineFromUrl)) return;
    setSelectedId((s) => (s === pipelineFromUrl ? s : pipelineFromUrl));
  }, [pipelineFromUrl, pipelines]);

  async function handleSave(nodes: Node[], edges: Edge[]) {
    if (!selectedId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/elt/pipelines/${selectedId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvas: { nodes, edges, v: 1 } }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[] };
        const detail =
          Array.isArray(err.errors) && err.errors.length > 0
            ? err.errors.join(" ")
            : typeof err.error === "string"
              ? err.error
              : JSON.stringify(err);
        throw new Error(detail);
      }
      const data = (await res.json().catch(() => ({}))) as {
        pipeline?: { sourceConfiguration?: Record<string, unknown> };
      };
      if (data.pipeline?.sourceConfiguration) {
        const full = data.pipeline.sourceConfiguration;
        lastFullSourceConfigRef.current = { ...full };
        hydrateFormFromSourceConfig(
          full,
          pipelineSourceType || "github",
          pipelineDestinationType || "duckdb"
        );
      }
      setLoadedGraph({ nodes, edges });
      setLoadedSig(JSON.stringify({ nodes, edges }));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSourceConfiguration() {
    if (!selectedId) return;
    setSourceConfigSaving(true);
    setSourceConfigError(null);
    try {
      const st = pipelineSourceType || "github";
      const dt = pipelineDestinationType || "duckdb";
      let base: Record<string, unknown>;
      if (advancedJsonDirty) {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(sourceConfigText.trim() || "{}") as Record<string, unknown>;
        } catch {
          throw new Error("Advanced JSON must be valid");
        }
        const { core, connection } = extractConnectionValues(parsed, st, dt);
        const nextCore = ensureGithubReposForForm(core);
        setSourceCfg(nextCore);
        setConnectionValues({ ...emptyConnectionValuesForTypes(st, dt), ...connection });
        const fields = getSourceConfigurationFields(st);
        setConnectorJson(fields.length === 0 ? JSON.stringify(nextCore, null, 2) : "{}");
        setAdvancedJsonDirty(false);
        base = sanitizeCredentialsForPersistence(mergeConnectionStrings(nextCore, connection));
      } else {
        base = sanitizeCredentialsForPersistence(buildBaseSourceConfiguration());
      }
      const merged = attachCanvasToSourceConfiguration(base, loadedGraph, lastFullSourceConfigRef.current);
      const res = await fetch(`/api/elt/pipelines/${selectedId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceConfiguration: merged }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        pipeline?: { sourceConfiguration?: Record<string, unknown> };
      };
      if (!res.ok) {
        const err = data.error;
        const msg =
          typeof err === "string"
            ? err
            : "Could not save source configuration";
        throw new Error(msg);
      }
      if (data.pipeline?.sourceConfiguration) {
        const full = data.pipeline.sourceConfiguration;
        lastFullSourceConfigRef.current = { ...full };
        hydrateFormFromSourceConfig(full, st, dt);
      }
    } catch (e) {
      setSourceConfigError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSourceConfigSaving(false);
    }
  }

  function renderCanvasInspectorPanel(focus: CanvasInspectorFocus): ReactNode {
    const stickyHeaderClass =
      "border-b border-slate-200 pb-3 dark:border-slate-600";

    if (focus.kind === "none") {
      return (
        <div className="flex flex-col gap-3 py-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Select a node</p>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Click a <strong className="font-medium text-slate-800 dark:text-slate-200">source</strong> or{" "}
            <strong className="font-medium text-slate-800 dark:text-slate-200">destination</strong> on the diagram, or a{" "}
            <strong className="font-medium text-slate-800 dark:text-slate-200">transform</strong> when you have one.
            Settings for that step appear here.
          </p>
        </div>
      );
    }

    if (focus.kind === "transform") {
      return (
        <div className="space-y-4">
          <div className={stickyHeaderClass}>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Transform</h2>
            <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
              Transform step for this pipeline. Use <strong className="font-medium">Save to pipeline</strong> on the canvas
              toolbar to persist the graph.
            </p>
          </div>
          <CanvasTransformInspector
            key={focus.nodeId}
            nodeId={focus.nodeId}
            initialData={focus.data}
            pipelineTool={pipelineTool}
            onPatch={(p) => canvasControlRef.current?.patchNodeData(focus.nodeId, p)}
          />
        </div>
      );
    }

    if (focus.kind === "source") {
      return (
        <div className="space-y-4">
          <div className={stickyHeaderClass}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Source</h2>
                <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                  Extract / connector (same as form builder). <code className="text-[10px]">canvas</code> merges from the
                  diagram when you save.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleSaveSourceConfiguration()}
                disabled={sourceConfigSaving}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {sourceConfigSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save source config
              </button>
            </div>
          </div>

          <FormAccordion
            id="canvas-inspector-source"
            title="Connector & credentials"
            subtitle="Catalog fields for this source type"
            defaultOpen
          >
            <GuidedSourceBlock
              sourceType={pipelineSourceType || "github"}
              schemaFields={schemaFields}
              sourceCfg={sourceCfg}
              onSourceCfgChange={setSourceCfg}
              connectionValues={connectionValues}
              onConnectionPatch={patchConnection}
              genericConnectorJson={
                schemaFields.length === 0
                  ? { value: connectorJson, onChange: setConnectorJson }
                  : undefined
              }
            />
          </FormAccordion>

          <div>
            <CopyEnvButton values={sourceEnvValues} />
          </div>

          <details className="group rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-white [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <span className="text-slate-400 transition group-open:rotate-90">▸</span>
                Advanced: full JSON (no canvas)
              </span>
            </summary>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Edit the full object sent to the API (minus <code className="text-[11px]">canvas</code>). Saving applies this
              JSON first, then syncs the guided fields.
            </p>
            <textarea
              value={sourceConfigText}
              onChange={(e) => {
                setSourceConfigText(e.target.value);
                setAdvancedJsonDirty(true);
              }}
              rows={10}
              spellCheck={false}
              className="mt-3 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              aria-label="Advanced source configuration JSON"
            />
          </details>

          {sourceConfigError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {sourceConfigError}
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className={stickyHeaderClass}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Destination</h2>
              <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                Load target and warehouse credentials (same as form builder).
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSaveSourceConfiguration()}
              disabled={sourceConfigSaving}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {sourceConfigSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save source config
            </button>
          </div>
        </div>

        <FormAccordion
          id="canvas-inspector-destination"
          title="Load target & credentials"
          subtitle="Dataset / instance and destination secrets"
          defaultOpen
        >
          <GuidedDestinationBlock
            destinationType={pipelineDestinationType || "duckdb"}
            sourceCfg={sourceCfg}
            onSourceCfgChange={setSourceCfg}
            connectionValues={connectionValues}
            onConnectionPatch={patchConnection}
          />
        </FormAccordion>

        <div>
          <CopyEnvButton values={destinationEnvValues} />
        </div>

        <details className="group rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-white [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span className="text-slate-400 transition group-open:rotate-90">▸</span>
              Advanced: full JSON (no canvas)
            </span>
          </summary>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Edit the full object sent to the API (minus <code className="text-[11px]">canvas</code>). Saving applies this JSON
            first, then syncs the guided fields.
          </p>
          <textarea
            value={sourceConfigText}
            onChange={(e) => {
              setSourceConfigText(e.target.value);
              setAdvancedJsonDirty(true);
            }}
            rows={10}
            spellCheck={false}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            aria-label="Advanced source configuration JSON"
          />
        </details>

        {sourceConfigError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {sourceConfigError}
          </p>
        ) : null}
      </div>
    );
  }

  const selectedName = pipelines.find((p) => p.id === selectedId)?.name;
  const showDockedInspector = pipelines.length > 0 && Boolean(selectedId) && !detailLoading;

  return (
    <div className={clsx("space-y-6", showDockedInspector && "lg:pr-[380px]")}>
      <h1 className="text-left text-2xl font-bold text-slate-900 dark:text-white">Visual pipeline canvas</h1>

      <div className="w-full min-w-0 space-y-4">
        {listLoading ? (
          <EltLoadingState />
        ) : (
          <>
            {(pipelines.length === 0 || showNewPipelineForm) && (
              <form
                onSubmit={handleCreatePipeline}
                className="mt-4 max-w-xl space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40"
              >
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {pipelines.length === 0 ? "Create your first pipeline" : "New pipeline"}
                </p>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Name</span>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="my_pipeline"
                    autoComplete="off"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                    disabled={createBusy}
                  />
                  <span className="text-xs text-slate-500">Letters, numbers, underscore; start with a letter.</span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Source</span>
                    <select
                      value={newSourceType}
                      onChange={(e) => setNewSourceType(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                      disabled={createBusy}
                    >
                      {Object.entries(SOURCE_GROUPS).map(([group, types]) => (
                        <optgroup key={group} label={group}>
                          {types.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Destination</span>
                    <select
                      value={newDestinationType}
                      onChange={(e) => setNewDestinationType(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                      disabled={createBusy}
                    >
                      {Object.entries(DESTINATION_GROUPS).map(([group, types]) => (
                        <optgroup key={group} label={group}>
                          {types.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                </div>
                {createError ? (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {createError}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={createBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
                  >
                    {createBusy ? "Creating…" : "Create & open canvas"}
                  </button>
                  {pipelines.length > 0 ? (
                    <button
                      type="button"
                      disabled={createBusy}
                      onClick={() => {
                        setShowNewPipelineForm(false);
                        setCreateError(null);
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            )}

            {pipelines.length > 0 ? (
              <div className="mt-4 flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
                <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Pipeline</span>
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                  >
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!showNewPipelineForm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewPipelineForm(true);
                      setCreateError(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                    New pipeline
                  </button>
                ) : null}
                {selectedName ? (
                  <span className="w-full text-xs text-slate-500 sm:w-auto sm:pb-2">
                    Editing <strong className="font-medium text-slate-700 dark:text-slate-300">{selectedName}</strong> ·{" "}
                    <Link
                      href={`/builder?pipeline=${encodeURIComponent(selectedId)}`}
                      className="text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Open in form builder
                    </Link>
                  </span>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      {pipelines.length > 0 && selectedId ? (
        <div className="w-full min-w-0">
          {detailLoading ? (
            <div className="flex h-[max(28rem,min(calc(100dvh-8rem),56rem))] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
              <EltLoadingState message="Loading pipeline…" size="md" />
            </div>
          ) : (
            <>
              <div className="min-w-0">
                <PipelineCanvas
                  key={selectedId}
                  pipelineId={selectedId}
                  loadedGraph={loadedGraph}
                  graphRevision={loadedSig}
                  onSave={handleSave}
                  saving={saving}
                  saveError={saveError}
                  pipelineSourceType={pipelineSourceType}
                  pipelineDestinationType={pipelineDestinationType}
                  onPickSourceType={(t) => void patchPipelineBindings({ sourceType: t })}
                  onPickDestinationType={(t) => void patchPipelineBindings({ destinationType: t })}
                  bindingsBusy={bindingsBusy}
                  bindingsError={bindingsError}
                  canvasControlRef={canvasControlRef}
                  onInspectorFocusChange={setInspectorFocus}
                />
              </div>
              <aside
                className={clsx(
                  "mt-4 w-full border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/95",
                  "rounded-2xl",
                  "lg:fixed lg:bottom-0 lg:right-0 lg:top-14 lg:z-20 lg:mt-0 lg:w-[380px] lg:max-w-[380px] lg:overflow-y-auto lg:overscroll-contain lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b-0 lg:border-l lg:p-4 lg:shadow-none"
                )}
                aria-label="Pipeline settings"
              >
                {renderCanvasInspectorPanel(inspectorFocus)}
              </aside>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
