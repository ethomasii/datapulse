"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Edge, Node } from "@xyflow/react";
import { Loader2 } from "lucide-react";
import { CanvasPreviewPanel } from "@/components/pipeline-canvas/canvas-preview-panel";
import { DesignerFullscreenShell } from "@/components/pipeline-canvas/designer-fullscreen-shell";
import { DesignerMobileChrome } from "@/components/pipeline-canvas/designer-mobile-chrome";
import { GenieCanvasBar } from "@/components/pipeline-canvas/genie-canvas-bar";
import { OperatorsSidebar } from "@/components/pipeline-canvas/operators-sidebar";
import { LakeStarterGallery } from "@/components/elt/lake-starter-gallery";
import { LakeStarterChips } from "@/components/elt/lake-starter-chips";
import type { LakeStarterApplyResult } from "@/components/elt/lake-starter-apply-dialog";
import { ComponentPalette } from "@/components/elt/component-palette";
import { CopyEnvButton } from "@/components/elt/copy-env-button";
import { ConnectionPicker } from "@/components/elt/connection-picker";
import { FormAccordion } from "@/components/elt/form-accordion";
import { GuidedDestinationBlock } from "@/components/elt/guided-destination-block";
import { GuidedSourceBlock } from "@/components/elt/guided-source-block";
import { useLinkedConnectionMeta } from "@/lib/hooks/use-linked-connection-meta";
import { CanvasTransformInspector } from "@/components/pipeline-canvas/canvas-transform-inspector";
import { CanvasComponentInspector } from "@/components/pipeline-canvas/canvas-component-inspector";
import { useWorkspacePermissions } from "@/lib/hooks/use-workspace-permissions";
import { builderUrl, parseBuilderCanvasTab, type BuilderCanvasTab } from "@/lib/elt/builder-nav";
import type { DbtTransformNodeData } from "@/lib/elt/dbt-canvas";
import { CanvasAssetLineagePanel } from "@/components/pipeline-canvas/canvas-asset-lineage-panel";
import {
  type CanvasInspectorFocus,
  type PipelineCanvasControl,
  PipelineCanvas,
} from "@/components/pipeline-canvas/pipeline-canvas";
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
import { enrichTransformNodesFromDltDbt, enrichPostTransformNodes } from "@/lib/elt/dbt-canvas";
import { readDbtTransformConfig } from "@/lib/elt/dbt-run-phases";
import { attachCanvasToSourceConfiguration } from "@/lib/elt/merge-canvas-into-source-config";
import {
  isTransformOnlyPipeline,
  transformOnlyCanvasGraph,
} from "@/lib/elt/pipeline-mode";
import { ensureGithubReposForForm } from "@/lib/elt/normalize-source-configuration";
import { hydrateCanvasFromSourceConfiguration, extractSpecComponents, defaultPipelineCanvasBackbone } from "@/lib/elt/spec-components-to-canvas";
import { TransformDagPanel } from "@/components/pipeline-canvas/transform-dag-panel";
import { IngestPanel } from "@/components/pipeline-canvas/ingest-panel";
import { lakeStarterCanvasGraph } from "@/lib/elt/lake-pipeline-starters";
import { defaultSourceTable } from "@/lib/elt/lake-defaults";

function pickConnectionSubset(values: Record<string, string>, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = values[k] ?? "";
  return out;
}

/** Canvas editor for one pipeline â€” mounted from /builder?view=canvas&pipeline=â€¦ */
export function CanvasPageClient({ pipelineId }: { pipelineId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = pipelineId;

  const [selectedName, setSelectedName] = useState<string>("");
  const [detailLoading, setDetailLoading] = useState(true);
  const [loadedGraph, setLoadedGraph] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [loadedSig, setLoadedSig] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pipelineSourceType, setPipelineSourceType] = useState("");
  const [pipelineDestinationType, setPipelineDestinationType] = useState("");
  /** Resolved sync mode: connector sync supports in-pipeline dbt; database replication does not. */
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
  const [sourceConnectionId, setSourceConnectionId] = useState<string | null>(null);
  const linkedSourceConnection = useLinkedConnectionMeta(sourceConnectionId);
  const [destinationConnectionId, setDestinationConnectionId] = useState<string | null>(null);
  /** When the catalog has no source schema, connector fields are edited as JSON. */
  const [connectorJson, setConnectorJson] = useState("{}");
  const [advancedJsonDirty, setAdvancedJsonDirty] = useState(false);
  const [linkedDbtProjectId, setLinkedDbtProjectId] = useState<string | null>(null);
  const [transformOnlyMode, setTransformOnlyMode] = useState(false);
  const [canvasView, setCanvasViewState] = useState<BuilderCanvasTab>(() =>
    parseBuilderCanvasTab(searchParams.get("canvas"))
  );
  const [starterNotice, setStarterNotice] = useState<string | null>(null);
  const [graphStats, setGraphStats] = useState({ componentNodeCount: 0, hasIngestBackbone: false });
  const starterAppliedRef = useRef(false);

  const starterFromUrl = searchParams.get("starter");
  const sourceTableFromUrl = searchParams.get("source_table")?.trim() ?? "";

  const setCanvasView = useCallback(
    (view: BuilderCanvasTab) => {
      setCanvasViewState(view);
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", "canvas");
      params.set("pipeline", pipelineId);
      if (view === "designer") params.delete("canvas");
      else params.set("canvas", view);
      router.replace(builderUrl({ pipeline: pipelineId, view: "canvas", canvas: view }), { scroll: false });
    },
    [pipelineId, router, searchParams]
  );

  useEffect(() => {
    setCanvasViewState(parseBuilderCanvasTab(searchParams.get("canvas")));
  }, [searchParams]);

  const { permissions } = useWorkspacePermissions();
  const canWrite = permissions?.canWrite ?? true;

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

  const selectedStepLabel = useMemo(() => {
    if (inspectorFocus.kind === "component") {
      return String(inspectorFocus.data.label ?? inspectorFocus.data.componentId ?? "");
    }
    if (inspectorFocus.kind === "transform") {
      return String(inspectorFocus.data.label ?? "Transform");
    }
    return undefined;
  }, [inspectorFocus]);

  const liveStepConfig = useMemo(() => {
    if (inspectorFocus.kind !== "component") return null;
    return (inspectorFocus.data.config as Record<string, unknown>) ?? {};
  }, [inspectorFocus]);

  const canvasGenieNode = useMemo(() => {
    if (inspectorFocus.kind !== "component") return null;
    return {
      nodeId: inspectorFocus.nodeId,
      componentId: String(inspectorFocus.data.componentId ?? ""),
      label: String(inspectorFocus.data.label ?? ""),
      config: (inspectorFocus.data.config as Record<string, unknown>) ?? {},
    };
  }, [inspectorFocus]);

  const existingCanvasGraph = useMemo(
    () => (loadedGraph ? { nodes: loadedGraph.nodes, edges: loadedGraph.edges, v: 1 as const } : null),
    [loadedGraph]
  );

  const handleLakeStarterApply = useCallback(
    async (result: LakeStarterApplyResult) => {
      if (!selectedId) {
        setStarterNotice("Select or create a pipeline first.");
        return;
      }
      canvasControlRef.current?.replaceGraph(result.nodes, result.edges);
      let notice = `${result.title}: ${result.stepCount} warehouse SQL steps on canvas â€” save to compile on your destination.`;
      if (result.medallion) {
        const merged = {
          ...lastFullSourceConfigRef.current,
          elt_medallion: result.medallion,
        };
        lastFullSourceConfigRef.current = merged;
        try {
          const res = await fetch(`/api/elt/pipelines/${selectedId}`, {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceConfiguration: merged }),
          });
          if (res.ok) {
            notice += " Bronzeâ†’gold medallion layers tagged on assets.";
          }
        } catch {
          /* best-effort medallion hint */
        }
      }
      setStarterNotice(notice);
    },
    [selectedId]
  );

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

  useEffect(() => {
    starterAppliedRef.current = false;
    setStarterNotice(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !starterFromUrl || starterAppliedRef.current || detailLoading) return;
    const timer = window.setTimeout(() => {
      if (!canvasControlRef.current) return;
      const result = lakeStarterCanvasGraph({
        starter_id: starterFromUrl,
        source_table: sourceTableFromUrl,
        existingCanvas: loadedGraph
          ? { nodes: loadedGraph.nodes, edges: loadedGraph.edges, v: 1 }
          : null,
      });
      if (!result.nodes.length) return;
      canvasControlRef.current.replaceGraph(result.nodes, result.edges);
      setStarterNotice(`${result.title} loaded â€” save pipeline to compile warehouse SQL.`);
      starterAppliedRef.current = true;
    }, 400);
    return () => window.clearTimeout(timer);
  }, [selectedId, starterFromUrl, sourceTableFromUrl, detailLoading, loadedSig, loadedGraph]);

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
      setLinkedDbtProjectId(null);
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
      const row = data.pipeline as {
        name?: string;
        sourceType?: string;
        destinationType?: string;
        tool?: string;
        dbtProjectId?: string | null;
        sourceConnectionId?: string | null;
        destinationConnectionId?: string | null;
      };
      setLinkedDbtProjectId(row.dbtProjectId ?? null);
      setSourceConnectionId(row.sourceConnectionId ?? null);
      setDestinationConnectionId(row.destinationConnectionId ?? null);
      setSelectedName(typeof row.name === "string" ? row.name : "Pipeline");
      setPipelineSourceType(typeof row.sourceType === "string" ? row.sourceType : "");
      setPipelineDestinationType(typeof row.destinationType === "string" ? row.destinationType : "");
      const st0 = typeof row.sourceType === "string" ? row.sourceType : "github";
      const dt0 = typeof row.destinationType === "string" ? row.destinationType : "duckdb";
      const t = row.tool;
      setPipelineTool(t === "dlt" || t === "sling" ? t : chooseTool(st0, dt0));
      const cfg = (data.pipeline.sourceConfiguration ?? {}) as Record<string, unknown>;
      lastFullSourceConfigRef.current = { ...cfg };
      setTransformOnlyMode(isTransformOnlyPipeline(cfg));
      const st = typeof row.sourceType === "string" ? row.sourceType : "github";
      const dt = typeof row.destinationType === "string" ? row.destinationType : "duckdb";
      hydrateFormFromSourceConfig(cfg, st, dt);
      let canvas =
        hydrateCanvasFromSourceConfiguration(cfg, row.name) ?? getCanvasFromSourceConfig(cfg);
      if (!canvas?.nodes?.length) {
        if (isTransformOnlyPipeline(cfg)) {
          canvas = transformOnlyCanvasGraph({
            warehouseLabel: dt.replace(/_/g, " "),
          });
        } else {
          canvas = defaultPipelineCanvasBackbone(st, dt);
        }
      }
      if (canvas && Array.isArray(canvas.nodes) && Array.isArray(canvas.edges)) {
        const rawDbt = readDbtTransformConfig(cfg);
        const dbtObj =
          rawDbt && typeof rawDbt === "object" && !Array.isArray(rawDbt) ? (rawDbt as Record<string, unknown>) : null;
        const rawPt = cfg.post_transform;
        const ptObj = rawPt && typeof rawPt === "object" && !Array.isArray(rawPt) ? (rawPt as Record<string, unknown>) : null;
        const nodes = enrichPostTransformNodes(
          enrichTransformNodesFromDltDbt(canvas.nodes as Node[], dbtObj),
          ptObj
        );
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
            if (parts.length) msg = parts.join(" Â· ");
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

  const patchPipelineConnection = useCallback(
    async (patch: { sourceConnectionId?: string | null; destinationConnectionId?: string | null }) => {
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
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        if (!res.ok) {
          const err = data.error;
          throw new Error(typeof err === "string" ? err : "Could not update saved connection link");
        }
      } catch (e) {
        setBindingsError(e instanceof Error ? e.message : "Update failed");
      } finally {
        setBindingsBusy(false);
      }
    },
    [selectedId]
  );

  function hasDbtTransform(nodes: Node[]): boolean {
    return nodes.some(
      (n) =>
        n.type === "transformNode" &&
        String((n.data as DbtTransformNodeData | undefined)?.transformTool) === "dbt"
    );
  }

  function parseGitFromDbtPath(path: string): { gitUrl: string | null; packagePath: string } {
    const trimmed = path.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return { gitUrl: trimmed, packagePath: trimmed };
    }
    return { gitUrl: null, packagePath: trimmed };
  }

  async function syncLinkedDbtProjectBeforeSave(nodes: Node[]): Promise<boolean> {
    if (!linkedDbtProjectId || !hasDbtTransform(nodes)) return true;
    const dbtNode = nodes.find(
      (n) =>
        n.type === "transformNode" &&
        String((n.data as DbtTransformNodeData | undefined)?.transformTool) === "dbt"
    );
    if (!dbtNode) return true;
    const d = (dbtNode.data ?? {}) as DbtTransformNodeData;
    const { gitUrl, packagePath } = parseGitFromDbtPath(String(d.dbtPackagePath ?? ""));
    if (!packagePath) {
      setSaveError("dbt project path or Git URL is required");
      return false;
    }
    const runScope = String(d.dbtRunScope ?? "all").trim() === "selection" ? "selection" : "all";
    try {
      const res = await fetch(`/api/elt/dbt/projects/${linkedDbtProjectId}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packagePath,
          gitUrl,
          gitBranch: String(d.dbtRepositoryBranch ?? "").trim() || "main",
          targetSchema: String(d.dbtDatasetName ?? "").trim() || null,
          runScope,
          selector: runScope === "selection" ? String(d.dbtSelector ?? "").trim() || null : null,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof err.error === "string" ? err.error : "Failed to update linked dbt project");
      }
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to update linked dbt project");
      return false;
    }
  }

  async function handleSave(nodes: Node[], edges: Edge[]) {
    if (!selectedId || !canWrite) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (!(await syncLinkedDbtProjectBeforeSave(nodes))) {
        setSaving(false);
        return;
      }
      const body: Record<string, unknown> = { canvas: { nodes, edges, v: 1 } };
      if (hasDbtTransform(nodes)) {
        body.dbtProjectId = linkedDbtProjectId;
      } else if (linkedDbtProjectId) {
        body.dbtProjectId = null;
      }
      const res = await fetch(`/api/elt/pipelines/${selectedId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
        monitorApply?: { created: string[]; skipped: string[]; errors: string[] };
      };
      if (data.monitorApply?.created.length) {
        setSaveError(null);
      }
      if (data.monitorApply?.errors.length) {
        setSaveError(`Monitors: ${data.monitorApply.errors.join("; ")}`);
      }
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
    if (!selectedId || !canWrite) return;
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
        <div className="flex flex-col gap-4 py-2">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Select a node</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Click a <strong className="font-medium text-slate-800 dark:text-slate-200">source</strong>,{" "}
              <strong className="font-medium text-slate-800 dark:text-slate-200">destination</strong>, or{" "}
              <strong className="font-medium text-slate-800 dark:text-slate-200">transform</strong> on the diagram.
              To remove a wire, click the line between nodes and use{" "}
              <strong className="font-medium text-slate-800 dark:text-slate-200">Disconnect</strong> (or Delete).
            </p>
          </div>
          {selectedId && selectedName && pipelineSourceType && pipelineDestinationType ? (
            <CanvasAssetLineagePanel
              pipelineId={selectedId}
              pipelineName={selectedName}
              tool={pipelineTool}
              sourceType={pipelineSourceType}
              destinationType={pipelineDestinationType}
              sourceConfiguration={lineageSourceConfig}
            />
          ) : null}
        </div>
      );
    }

    if (focus.kind === "transform") {
      return (
        <div className="space-y-4">
          <div className={stickyHeaderClass}>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Transform</h2>
            <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
              Code transform (dbt / SQL / Python). Native steps â€” cleanse, join, aggregate â€” use{" "}
              <strong className="font-medium text-violet-800 dark:text-violet-200">Native</strong> on the toolbar or the
              catalog below.
            </p>
          </div>
          <CanvasTransformInspector
            key={focus.nodeId}
            nodeId={focus.nodeId}
            initialData={focus.data}
            pipelineTool={pipelineTool}
            pipelineId={selectedId}
            sourceSlug={pipelineSourceType}
            linkedDbtProjectId={linkedDbtProjectId}
            onLinkedDbtProjectChange={setLinkedDbtProjectId}
            readOnly={!canWrite}
            onPatch={(p) => canvasControlRef.current?.patchNodeData(focus.nodeId, p)}
          />
        </div>
      );
    }

    if (focus.kind === "component") {
      return (
        <div className="space-y-4">
          <div className={stickyHeaderClass}>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Operator configuration</h2>
            <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
              Column mapping, filters, and step settings â€” same panel as Lakeflow&apos;s operator config.
            </p>
          </div>
          <CanvasComponentInspector
            key={focus.nodeId}
            nodeId={focus.nodeId}
            initialData={focus.data}
            pipelineId={selectedId}
            readOnly={!canWrite}
            hideInlinePreview
            autoApply
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
                disabled={sourceConfigSaving || !canWrite}
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
            <div className="mb-3">
              <ConnectionPicker
                connectionType="source"
                connector={pipelineSourceType || "github"}
                selectedConnectionId={sourceConnectionId}
                currentValues={connectionValues}
                onSelect={({ id, config }) => {
                  setSourceConnectionId(id);
                  if (Object.keys(config).length > 0) {
                    setConnectionValues((prev) => ({ ...prev, ...config }));
                  }
                  void patchPipelineConnection({ sourceConnectionId: id });
                }}
              />
            </div>
            <GuidedSourceBlock
              sourceType={pipelineSourceType || "github"}
              schemaFields={schemaFields}
              sourceCfg={sourceCfg}
              onSourceCfgChange={setSourceCfg}
              connectionValues={connectionValues}
              onConnectionPatch={patchConnection}
              sourceConnectionId={sourceConnectionId}
              linkedSourceConnection={
                linkedSourceConnection
                  ? {
                      name: linkedSourceConnection.name,
                      hasStoredSecrets: Boolean(linkedSourceConnection.hasStoredSecrets),
                    }
                  : null
              }
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
                <span className="text-slate-400 transition group-open:rotate-90">â–¸</span>
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
          <div className="mb-3">
            <ConnectionPicker
              connectionType="destination"
              connector={pipelineDestinationType || "postgres"}
              selectedConnectionId={destinationConnectionId}
              currentValues={connectionValues}
              onSelect={({ id, config }) => {
                setDestinationConnectionId(id);
                if (Object.keys(config).length > 0) {
                  setConnectionValues((prev) => ({ ...prev, ...config }));
                }
                void patchPipelineConnection({ destinationConnectionId: id });
              }}
            />
          </div>
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
              <span className="text-slate-400 transition group-open:rotate-90">â–¸</span>
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

  const lakeDefaultSourceTable = useMemo(
    () =>
      defaultSourceTable({
        pipelineName: selectedName,
        schemaOverride:
          typeof sourceCfg.schema_override === "string" ? sourceCfg.schema_override : undefined,
        fallback: sourceTableFromUrl || undefined,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadedSig bumps when pipeline config is reloaded
    [selectedName, sourceCfg.schema_override, sourceTableFromUrl, loadedSig]
  );

  const lineageSourceConfig = useMemo(
    () => ({ ...lastFullSourceConfigRef.current, ...sourceCfg }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadedSig bumps when pipeline config is reloaded
    [sourceCfg, loadedSig, selectedId]
  );

  function renderDesignerWorkspace() {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
        <OperatorsSidebar
          className="hidden h-full w-[220px] shrink-0 xl:w-[260px] 2xl:w-[300px] lg:flex"
          onSelect={(c) => canvasControlRef.current?.addComponentNode(c)}
          onAddSource={() => canvasControlRef.current?.addSourceNode()}
          onAddDestination={() => canvasControlRef.current?.addDestinationNode()}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            <PipelineCanvas
              key={selectedId}
              variant="designer"
              pipelineId={selectedId}
              loadedGraph={loadedGraph}
              graphRevision={loadedSig}
              onSave={handleSave}
              saving={saving}
              saveError={saveError}
              saveDisabled={!canWrite}
              pipelineSourceType={pipelineSourceType}
              pipelineDestinationType={pipelineDestinationType}
              transformOnly={transformOnlyMode}
              onPickSourceType={(t) => void patchPipelineBindings({ sourceType: t })}
              onPickDestinationType={(t) => void patchPipelineBindings({ destinationType: t })}
              bindingsBusy={bindingsBusy}
              bindingsError={bindingsError}
              canvasControlRef={canvasControlRef}
              onInspectorFocusChange={setInspectorFocus}
              onGraphStatsChange={setGraphStats}
              showEmptyStateOverlay={
                graphStats.componentNodeCount === 0 && !graphStats.hasIngestBackbone
              }
              emptyStateOverlay={
                <LakeStarterChips
                  variant="overlay"
                  defaultSourceTable={lakeDefaultSourceTable}
                  existingCanvas={existingCanvasGraph}
                  onApply={handleLakeStarterApply}
                />
              }
            />
          </div>
          <GenieCanvasBar
            pipelineId={selectedId}
            selectedLabel={selectedStepLabel}
            canvasNode={canvasGenieNode}
            getCanvasSnapshot={() => canvasControlRef.current?.getGraph() ?? null}
            onPatchNode={(nodeId, patch) => canvasControlRef.current?.patchNodeData(nodeId, patch)}
            onReplaceGraph={(nodes, edges) => canvasControlRef.current?.replaceGraph(nodes, edges)}
            onPipelinePatched={() => void loadPipelineGraph(selectedId)}
          />
          <CanvasPreviewPanel
            pipelineId={selectedId}
            focus={inspectorFocus}
            liveConfig={liveStepConfig}
            className="h-48 shrink-0 xl:h-56 2xl:h-64"
          />
          <DesignerMobileChrome
            operators={
              <OperatorsSidebar
                className="h-full border-0"
                onSelect={(c) => canvasControlRef.current?.addComponentNode(c)}
                onAddSource={() => canvasControlRef.current?.addSourceNode()}
                onAddDestination={() => canvasControlRef.current?.addDestinationNode()}
              />
            }
            config={
              <div className="p-4">
                {starterNotice ? (
                  <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
                    <p>{starterNotice}</p>
                  </div>
                ) : null}
                {renderCanvasInspectorPanel(inspectorFocus)}
                {inspectorFocus.kind === "none" ? (
                  <LakeStarterGallery
                    compact
                    className="mt-4"
                    ingestConfigured={graphStats.hasIngestBackbone}
                    defaultSourceTable={lakeDefaultSourceTable}
                    existingCanvas={existingCanvasGraph}
                    onApplyToCanvas={handleLakeStarterApply}
                  />
                ) : null}
              </div>
            }
          />
        </div>
        <aside
          className="hidden h-full w-[320px] shrink-0 overflow-y-auto overscroll-contain border-l border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/95 xl:w-[360px] 2xl:w-[420px] lg:block"
          aria-label="Operator configuration"
        >
          {starterNotice ? (
            <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
              <p>{starterNotice}</p>
            </div>
          ) : null}
          {renderCanvasInspectorPanel(inspectorFocus)}
          {inspectorFocus.kind === "none" ? (
            <LakeStarterGallery
              compact
              className="mt-4"
              ingestConfigured={graphStats.hasIngestBackbone}
              defaultSourceTable={lakeDefaultSourceTable}
              existingCanvas={existingCanvasGraph}
              onApplyToCanvas={handleLakeStarterApply}
            />
          ) : null}
        </aside>
      </div>
    );
  }

  function renderIngestConfigSidebar() {
    return (
      <aside
        className="hidden h-full w-[320px] shrink-0 overflow-y-auto overscroll-contain border-l border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/95 xl:w-[360px] 2xl:w-[420px] lg:block"
        aria-label="Ingest configuration"
      >
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-3 dark:border-slate-600">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Ingest configuration</h2>
            <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
              Source connector, credentials, and ingest components.
            </p>
            <button
              type="button"
              onClick={() => void handleSaveSourceConfiguration()}
              disabled={sourceConfigSaving || !canWrite}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {sourceConfigSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save ingest config
            </button>
          </div>
          <FormAccordion
            id="ingest-inspector-source"
            title="Source connector"
            subtitle={pipelineSourceType.replace(/_/g, " ")}
            defaultOpen
          >
            <div className="mb-3">
              <ConnectionPicker
                connectionType="source"
                connector={pipelineSourceType || "github"}
                selectedConnectionId={sourceConnectionId}
                currentValues={connectionValues}
                onSelect={({ id, config }) => {
                  setSourceConnectionId(id);
                  if (Object.keys(config).length > 0) {
                    setConnectionValues((prev) => ({ ...prev, ...config }));
                  }
                  void patchPipelineConnection({ sourceConnectionId: id });
                }}
              />
            </div>
            <GuidedSourceBlock
              sourceType={pipelineSourceType || "github"}
              schemaFields={schemaFields}
              sourceCfg={sourceCfg}
              onSourceCfgChange={setSourceCfg}
              connectionValues={connectionValues}
              onConnectionPatch={patchConnection}
              sourceConnectionId={sourceConnectionId}
              linkedSourceConnection={
                linkedSourceConnection
                  ? {
                      name: linkedSourceConnection.name,
                      hasStoredSecrets: Boolean(linkedSourceConnection.hasStoredSecrets),
                    }
                  : null
              }
              genericConnectorJson={
                schemaFields.length === 0 ? { value: connectorJson, onChange: setConnectorJson } : undefined
              }
            />
            <div className="mt-3">
              <CopyEnvButton values={sourceEnvValues} />
            </div>
          </FormAccordion>
          <FormAccordion
            id="ingest-inspector-dest"
            title="Destination / warehouse"
            subtitle={pipelineDestinationType.replace(/_/g, " ")}
          >
            <div className="mb-3">
              <ConnectionPicker
                connectionType="destination"
                connector={pipelineDestinationType || "postgres"}
                selectedConnectionId={destinationConnectionId}
                currentValues={connectionValues}
                onSelect={({ id, config }) => {
                  setDestinationConnectionId(id);
                  if (Object.keys(config).length > 0) {
                    setConnectionValues((prev) => ({ ...prev, ...config }));
                  }
                  void patchPipelineConnection({ destinationConnectionId: id });
                }}
              />
            </div>
            <GuidedDestinationBlock
              destinationType={pipelineDestinationType || "postgres"}
              sourceCfg={sourceCfg}
              onSourceCfgChange={setSourceCfg}
              connectionValues={connectionValues}
              onConnectionPatch={patchConnection}
            />
            <div className="mt-3">
              <CopyEnvButton values={destinationEnvValues} />
            </div>
          </FormAccordion>
          {sourceConfigError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {sourceConfigError}
            </p>
          ) : null}
          <ComponentPalette
            className="h-[240px]"
            categoryFilter="ingestion"
            onSelect={(c) => {
              setCanvasView("designer");
              canvasControlRef.current?.addComponentNode(c);
            }}
          />
        </div>
      </aside>
    );
  }

  function renderIngestWorkspace() {
    return (
      <div className="flex h-full min-h-0 overflow-hidden lg:flex-row">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          <IngestPanel
            pipelineId={selectedId}
            pipelineName={selectedName || "pipeline"}
            tool={pipelineTool}
            sourceType={pipelineSourceType}
            destinationType={pipelineDestinationType}
            sourceConfiguration={lineageSourceConfig}
            canvasNodes={loadedGraph?.nodes ?? []}
            onSwitchToDesigner={() => setCanvasView("designer")}
          />
        </div>
        {renderIngestConfigSidebar()}
      </div>
    );
  }

  function renderDagWorkspace() {
    return (
      <div className="h-full overflow-y-auto p-4">
        <TransformDagPanel
          nodes={loadedGraph?.nodes ?? []}
          edges={loadedGraph?.edges ?? []}
          specComponents={extractSpecComponents(lastFullSourceConfigRef.current)}
          pipelineName={selectedName || "pipeline"}
        />
      </div>
    );
  }

  function renderCanvasViewContent() {
    if (canvasView === "designer") return renderDesignerWorkspace();
    if (canvasView === "ingest") return renderIngestWorkspace();
    return renderDagWorkspace();
  }

  return (
    <DesignerFullscreenShell
      selectedName={selectedName}
      canvasView={canvasView}
      onCanvasViewChange={setCanvasView}
      formBuilderHref={builderUrl({ pipeline: pipelineId })}
      loading={detailLoading}
      transformOnly={transformOnlyMode}
      readOnly={!canWrite}
      readOnlyRole={permissions?.role}
    >
      {renderCanvasViewContent()}
    </DesignerFullscreenShell>
  );
}
