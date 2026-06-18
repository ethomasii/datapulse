"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  Play,
  Plus,
  Trash2,
  Code2,
  RefreshCw,
  Pencil,
  Plug,
  Waypoints,
  Webhook,
  Workflow,
  History,
  TableProperties,
  Sparkles,
  LayoutGrid,
  Layers,
} from "lucide-react";
import { AiPipelineAssistant } from "@/components/elt/ai-pipeline-assistant";
import { DbtConfigFields } from "@/components/dbt/dbt-config-fields";
import { applyDbtProjectToForm, DbtProjectPicker } from "@/components/dbt/dbt-project-picker";
import { SourceCatalogWizard } from "@/components/elt/source-catalog-wizard";
import { chooseTool } from "@/lib/elt/choose-tool";
import { readDbtTransformConfig, setDbtTransformConfig } from "@/lib/elt/dbt-run-phases";
import { RelatedLinks } from "@/components/ui/related-links";
import {
  DESTINATION_OPTIONS,
  SOURCE_OPTIONS,
  DESTINATION_TYPES,
  SOURCE_TYPES,
} from "@/lib/elt/catalog";
import { ConnectorCombobox } from "@/components/elt/connector-combobox";
import { CopyEnvButton } from "@/components/elt/copy-env-button";
import { ConnectionPicker } from "@/components/elt/connection-picker";
import { FormAccordion } from "@/components/elt/form-accordion";
import { GuidedDestinationBlock } from "@/components/elt/guided-destination-block";
import { GuidedSourceBlock } from "@/components/elt/guided-source-block";
import { getSourceConfigurationFields } from "@/lib/elt/credentials-catalog";
import {
  emptyConnectionValuesForTypes,
  extractConnectionValues,
  mergeConnectionStrings,
  sanitizeCredentialsForPersistence,
} from "@/lib/elt/credential-payload";
import { ensureGithubReposForForm } from "@/lib/elt/normalize-source-configuration";
import { minimalSourceConfigurationForNewPipeline } from "@/lib/elt/minimal-source-configuration";
import {
  getCanvasFromSourceConfig,
  PIPELINE_CANVAS_KEY,
  type PipelineCanvasGraph,
} from "@/lib/elt/canvas-source-config";
import { EltLoadingState } from "@/components/elt/elt-loading-state";
import { PipelineCodeModal } from "@/components/elt/pipeline-code-modal";
import { getRunSliceCapability } from "@/lib/elt/run-slice-capabilities";
import { PartitionConfigEditor } from "@/components/elt/partition-config-editor";
import { PipelineRunPanel } from "@/components/elt/pipeline-run-panel";
import { EmptyState } from "@/components/ui/empty-state";

type PipelineExecutionHost = "inherit" | "eltpulse_managed" | "customer_gateway";

type PipelineRow = {
  id: string;
  name: string;
  tool: string;
  enabled: boolean;
  sourceType: string;
  destinationType: string;
  description: string | null;
  updatedAt: string;
  defaultTargetAgentTokenId: string | null;
  executionHost: PipelineExecutionHost;
};

type FormMode = "structured" | "json";

export function BuilderClient({
  initialEditPipelineId = null,
}: {
  initialEditPipelineId?: string | null;
}) {
  const searchParams = useSearchParams();
  /** Client query wins so soft navigation from Canvas / links always opens the right pipeline. */
  const pipelineIdFromUrl = searchParams.get("pipeline");
  const openPipelineIdFromQuery =
    typeof pipelineIdFromUrl === "string" && pipelineIdFromUrl.length > 0 ? pipelineIdFromUrl : null;
  const effectiveOpenPipelineId = openPipelineIdFromQuery ?? initialEditPipelineId;

  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
  const [gatewayOptions, setGatewayOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** When true, show the create form (listing stays above). */
  const [showCreateForm, setShowCreateForm] = useState(false);
  /** "ai" = inline AI chat, "browse" = source catalog wizard, "manual" = standard form */
  const [createMode, setCreateMode] = useState<"ai" | "browse" | "manual">("browse");
  const [detail, setDetail] = useState<{
    id: string;
    tool: string;
    pipelineCode: string;
    configYaml: string | null;
    workspaceYaml: string | null;
    name: string;
  } | null>(null);

  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState("github");
  const [destinationType, setDestinationType] = useState("duckdb");
  const [description, setDescription] = useState("");
  const [formMode, setFormMode] = useState<FormMode>("structured");
  const [sourceJson, setSourceJson] = useState("{}");
  /** Full `sourceConfiguration` for guided mode (SOURCE_CONFIGURATIONS + extras). */
  const [sourceCfg, setSourceCfg] = useState<Record<string, unknown>>(() =>
    minimalSourceConfigurationForNewPipeline("github")
  );

  const schemaFields = useMemo(() => getSourceConfigurationFields(sourceType), [sourceType]);
  const runSliceCapability = useMemo(() => getRunSliceCapability(sourceType), [sourceType]);

  const [tests, setTests] = useState("");
  /** Live monitors linked to this pipeline (loaded when editingId changes). */
  const [pipelineMonitors, setPipelineMonitors] = useState<{ name: string; type: string }[]>([]);
  const [sliceIntent, setSliceIntent] = useState<"full" | "sliced">("full");
  const [partitionsNote, setPartitionsNote] = useState("");
  const [otherNotes, setOtherNotes] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleCron, setScheduleCron] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState("UTC");
  /** Optional per-pipeline run webhook (overrides account default on Runs). */
  const [pipelineWebhookUrl, setPipelineWebhookUrl] = useState("");
  /** Visual canvas graph (stored in sourceConfiguration.canvas); form + canvas editors share this. */
  const [canvasGraph, setCanvasGraph] = useState<PipelineCanvasGraph | null>(null);
  /** SOURCE_CREDENTIALS + DESTINATION_CREDENTIALS form values (secrets not persisted). */
  const [connectionValues, setConnectionValues] = useState<Record<string, string>>(() =>
    emptyConnectionValuesForTypes("github", "duckdb")
  );
  /** Saved Connection rows linked to this pipeline (persisted as FKs; not stored in source_configuration). */
  const [sourceConnectionId, setSourceConnectionId] = useState<string | null>(null);
  const [destinationConnectionId, setDestinationConnectionId] = useState<string | null>(null);
  const [postTransformType, setPostTransformType] = useState<"" | "python" | "sql" | "dbt">("");
  const [postTransformCode, setPostTransformCode] = useState("");
  const [dbtPackagePath, setDbtPackagePath] = useState("");
  const [dbtDatasetName, setDbtDatasetName] = useState("");
  const [dbtRepositoryBranch, setDbtRepositoryBranch] = useState("");
  const [dbtRunScope, setDbtRunScope] = useState<"all" | "selection">("all");
  const [dbtSelector, setDbtSelector] = useState("");
  const [dbtSliceValueVar, setDbtSliceValueVar] = useState("");
  const [dbtSliceColumnVar, setDbtSliceColumnVar] = useState("");
  const [linkedDbtProjectId, setLinkedDbtProjectId] = useState<string | null>(null);

  const resolvedTool = useMemo(
    () => chooseTool(sourceType, destinationType),
    [sourceType, destinationType]
  );

  useEffect(() => {
    const src = searchParams.get("source");
    const wantDbt = searchParams.get("dbt") === "1";
    if (src) setSourceType(src);
    if (wantDbt) setPostTransformType("dbt");
  }, [searchParams]);

  const wantDbtSetup = searchParams.get("dbt") === "1";

  useEffect(() => {
    if (!wantDbtSetup) return;
    if (!effectiveOpenPipelineId) {
      setShowCreateForm(true);
      setCreateMode("manual");
    }
  }, [wantDbtSetup, effectiveOpenPipelineId]);

  useEffect(() => {
    if (!wantDbtSetup || !(showCreateForm || editingId)) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById("acc-transform");
      if (el instanceof HTMLDetailsElement) el.open = true;
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [wantDbtSetup, showCreateForm, editingId]);

  function patchConnection(key: string, value: string) {
    setConnectionValues((prev) => ({ ...prev, [key]: value }));
  }

  function eltLinesFromConfig(key: string, cfg: Record<string, unknown>): string {
    const v = cfg[key];
    if (Array.isArray(v)) return v.map(String).join("\n");
    return "";
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pipRes, gwRes] = await Promise.all([
        fetch("/api/elt/pipelines", { credentials: "same-origin" }),
        fetch("/api/elt/agent-status", { credentials: "same-origin" }),
      ]);
      if (!pipRes.ok) throw new Error(await pipRes.text());
      const data = await pipRes.json();
      setPipelines(data.pipelines ?? []);
      if (gwRes.ok) {
        const gw = (await gwRes.json()) as {
          connectors?: { id: string; name: string }[];
          organization?: { connectors?: { id: string; name: string }[]; name?: string } | null;
        };
        const personal = Array.isArray(gw.connectors)
          ? gw.connectors.map((c) => ({ id: c.id, name: c.name }))
          : [];
        const orgName = gw.organization?.name?.trim() || "Org";
        const orgList = Array.isArray(gw.organization?.connectors)
          ? gw.organization!.connectors!.map((c) => ({
              id: c.id,
              name: `${c.name} (${orgName})`,
            }))
          : [];
        setGatewayOptions([...personal, ...orgList]);
      } else {
        setGatewayOptions([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pipelines");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function buildSourceConfiguration(): Record<string, unknown> {
    if (formMode === "json") {
      return JSON.parse(sourceJson || "{}") as Record<string, unknown>;
    }
    if (schemaFields.length > 0) {
      return { ...sourceCfg };
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(sourceJson || "{}") as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    const next = { ...parsed };
    const so = sourceCfg.schema_override;
    if (typeof so === "string" && so.trim()) next.schema_override = so.trim();
    else delete next.schema_override;
    const di = sourceCfg.destination_instance;
    if (typeof di === "string" && di.trim()) next.destination_instance = di.trim();
    else delete next.destination_instance;
    return next;
  }

  function resetConnectorForNewSourceType(t: string, d: string) {
    const fields = getSourceConfigurationFields(t);
    const minimal = minimalSourceConfigurationForNewPipeline(t);
    setSourceCfg(minimal);
    setSourceJson(JSON.stringify(fields.length > 0 ? minimal : {}, null, 2));
    setConnectionValues(emptyConnectionValuesForTypes(t, d));
    setSourceConnectionId(null);
  }

  function mergeCanvasForSubmit(built: Record<string, unknown>): Record<string, unknown> {
    if (formMode === "json") {
      return built;
    }
    const next = { ...built };
    if (canvasGraph === null) {
      delete next[PIPELINE_CANVAS_KEY];
    } else {
      next[PIPELINE_CANVAS_KEY] = canvasGraph;
    }
    // Post-transform (Python / SQL)
    if ((postTransformType === "python" || postTransformType === "sql") && postTransformCode.trim()) {
      next.post_transform = { type: postTransformType, code: postTransformCode.trim() };
    } else {
      delete next.post_transform;
    }
    // dbt transform
    if (postTransformType === "dbt") {
      if (dbtPackagePath.trim()) {
        const dbtTransform: Record<string, unknown> = {
          enabled: true,
          package_path: dbtPackagePath.trim(),
          run_scope: dbtRunScope,
        };
        if (dbtDatasetName.trim()) dbtTransform.dataset_name = dbtDatasetName.trim();
        if (dbtRepositoryBranch.trim()) dbtTransform.package_repository_branch = dbtRepositoryBranch.trim();
        if (dbtRunScope === "selection" && dbtSelector.trim()) dbtTransform.selector = dbtSelector.trim();
        if (dbtSliceValueVar.trim()) dbtTransform.slice_value_var = dbtSliceValueVar.trim();
        if (dbtSliceColumnVar.trim()) dbtTransform.slice_column_var = dbtSliceColumnVar.trim();
        setDbtTransformConfig(next, dbtTransform);
      } else {
        setDbtTransformConfig(next, { enabled: false });
      }
    } else {
      setDbtTransformConfig(next, undefined);
    }
    return next;
  }

  function parseGitFromDbtPath(path: string): { gitUrl: string | null; packagePath: string } {
    const trimmed = path.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return { gitUrl: trimmed, packagePath: trimmed };
    }
    return { gitUrl: null, packagePath: trimmed };
  }

  function applyLinkedDbtProject(project: Parameters<typeof applyDbtProjectToForm>[0]) {
    const fields = applyDbtProjectToForm(project);
    setPostTransformType("dbt");
    setDbtPackagePath(fields.packagePath);
    setDbtDatasetName(fields.datasetName);
    setDbtRepositoryBranch(fields.repositoryBranch);
    setDbtRunScope(fields.runScope);
    setDbtSelector(fields.selector);
  }

  async function syncLinkedDbtProjectBeforeSave(): Promise<boolean> {
    if (postTransformType !== "dbt" || !linkedDbtProjectId) return true;
    const { gitUrl, packagePath } = parseGitFromDbtPath(dbtPackagePath);
    if (!packagePath) {
      setError("dbt project path or Git URL is required");
      return false;
    }
    try {
      const res = await fetch(`/api/elt/dbt/projects/${linkedDbtProjectId}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packagePath,
          gitUrl,
          gitBranch: dbtRepositoryBranch.trim() || "main",
          targetSchema: dbtDatasetName.trim() || null,
          runScope: dbtRunScope,
          selector: dbtRunScope === "selection" ? dbtSelector.trim() || null : null,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof err.error === "string" ? err.error : "Failed to update linked dbt project");
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update linked dbt project");
      return false;
    }
  }

  async function createPipeline(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    let sourceConfiguration: Record<string, unknown>;
    try {
      let built = buildSourceConfiguration();
      if (formMode === "structured") {
        built = mergeConnectionStrings(built, connectionValues);
      }
      built = sanitizeCredentialsForPersistence(built);
      sourceConfiguration = mergeCanvasForSubmit(built);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON or configuration");
      setCreating(false);
      return;
    }

    try {
      if (!(await syncLinkedDbtProjectBeforeSave())) {
        setCreating(false);
        return;
      }
      const res = await fetch(editingId ? `/api/elt/pipelines/${editingId}` : "/api/elt/pipelines", {
        method: editingId ? "PUT" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sourceType,
          destinationType,
          tool: "auto" as const,
          description: description || undefined,
          sourceConfiguration,
          sourceConnectionId: sourceConnectionId ?? null,
          destinationConnectionId: destinationConnectionId ?? null,
          tests,
          sliceIntent,
          partitionsNote,
          otherNotes,
          scheduleEnabled,
          scheduleCron: scheduleCron || undefined,
          scheduleTimezone: scheduleTimezone || undefined,
          runsWebhookUrl: pipelineWebhookUrl,
          ...(editingId
            ? { dbtProjectId: postTransformType === "dbt" ? linkedDbtProjectId : null }
            : linkedDbtProjectId && postTransformType === "dbt"
              ? { dbtProjectId: linkedDbtProjectId }
              : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : JSON.stringify(err));
      }
      if (!editingId) {
        setName("");
        setDescription("");
        setShowCreateForm(false);
        setTests("");
        setSliceIntent("full");
        setPartitionsNote("");
        setOtherNotes("");
        setScheduleEnabled(false);
        setScheduleCron("");
        setScheduleTimezone("UTC");
        setPipelineWebhookUrl("");
        setCanvasGraph(null);
        setSourceConnectionId(null);
        setDestinationConnectionId(null);
        resetConnectorForNewSourceType("github", "duckdb");
      } else {
        setEditingId(null);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : editingId ? "Save failed" : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function openNewPipeline() {
    setEditingId(null);
    setShowCreateForm(true);
    setError(null);
    setName("");
    setDescription("");
    setSourceType("github");
    setDestinationType("duckdb");
    setFormMode("structured");
    setTests("");
    setPipelineMonitors([]);
    setSliceIntent("full");
    setPartitionsNote("");
    setOtherNotes("");
    setScheduleEnabled(false);
    setScheduleCron("");
    setScheduleTimezone("UTC");
    setPipelineWebhookUrl("");
    setCanvasGraph(null);
    setSourceConnectionId(null);
    setDestinationConnectionId(null);
    setPostTransformType("");
    setPostTransformCode("");
    setDbtPackagePath("");
    setDbtDatasetName("");
    setDbtRepositoryBranch("");
    setDbtRunScope("all");
    setDbtSelector("");
    setDbtSliceValueVar("");
    setDbtSliceColumnVar("");
    setLinkedDbtProjectId(null);
    resetConnectorForNewSourceType("github", "duckdb");
  }

  function cancelCreate() {
    setShowCreateForm(false);
    setError(null);
  }

  const showPipelineForm = Boolean(editingId) || showCreateForm;

  /** Last pipeline id opened from `?pipeline=` — reset when cleared or load fails so retries work. */
  const lastOpenedFromUrlRef = useRef<string | null>(null);

  async function startEdit(id: string) {
    setShowCreateForm(false);
    setError(null);
    const res = await fetch(`/api/elt/pipelines/${id}`, { credentials: "same-origin" });
    if (!res.ok) {
      lastOpenedFromUrlRef.current = null;
      let msg = `Could not load pipeline (${res.status})`;
      try {
        const errBody = (await res.json()) as { error?: unknown };
        if (typeof errBody.error === "string") msg = errBody.error;
      } catch {
        /* ignore */
      }
      setError(msg);
      return;
    }
    const data = await res.json();
    const p = data.pipeline as {
      name: string;
      sourceType: string;
      destinationType: string;
      tool: string;
      description: string | null;
      sourceConfiguration: Record<string, unknown>;
      runsWebhookUrl?: string | null;
      sourceConnectionId?: string | null;
      destinationConnectionId?: string | null;
      dbtProjectId?: string | null;
    };
    setEditingId(id);
    setName(p.name);
    setSourceType(p.sourceType);
    setDestinationType(p.destinationType);
    setDescription(p.description ?? "");

    const cfg = p.sourceConfiguration ?? {};
    const { core, connection } = extractConnectionValues(cfg, p.sourceType, p.destinationType);
    setFormMode("structured");
    setSourceCfg(ensureGithubReposForForm(core));
    setConnectionValues({
      ...emptyConnectionValuesForTypes(p.sourceType, p.destinationType),
      ...connection,
    });
    setSourceJson(JSON.stringify(cfg, null, 2));
    setSourceConnectionId(p.sourceConnectionId ?? null);
    setDestinationConnectionId(p.destinationConnectionId ?? null);

    setTests(eltLinesFromConfig("elt_tests", cfg));
    const rawIntent = cfg.elt_slice_intent;
    setSliceIntent(rawIntent === "sliced" ? "sliced" : "full");
    setPartitionsNote(typeof cfg.elt_partitions_note === "string" ? cfg.elt_partitions_note : "");
    setOtherNotes(typeof cfg.elt_other_notes === "string" ? cfg.elt_other_notes : "");
    setScheduleEnabled(Boolean(cfg.schedule_enabled));
    setScheduleCron(typeof cfg.cron_schedule === "string" ? cfg.cron_schedule : "");
    setScheduleTimezone(typeof cfg.schedule_timezone === "string" ? cfg.schedule_timezone : "UTC");
    setPipelineWebhookUrl(typeof p.runsWebhookUrl === "string" ? p.runsWebhookUrl : "");
    setCanvasGraph(getCanvasFromSourceConfig(cfg));
    setLinkedDbtProjectId(p.dbtProjectId ?? null);
    const pt = cfg.post_transform as Record<string, unknown> | undefined;
    const dbtCfg = readDbtTransformConfig(cfg);
    const dbtPath = String(dbtCfg?.git_url ?? dbtCfg?.package_path ?? "").trim();
    if (dbtCfg?.enabled && dbtPath) {
      setPostTransformType("dbt");
      setDbtPackagePath(dbtPath);
      setDbtDatasetName(String(dbtCfg.dataset_name ?? ""));
      setDbtRepositoryBranch(String(dbtCfg.package_repository_branch ?? ""));
      setDbtRunScope(dbtCfg.run_scope === "selection" ? "selection" : "all");
      setDbtSelector(String(dbtCfg.selector ?? ""));
      setDbtSliceValueVar(String(dbtCfg.slice_value_var ?? ""));
      setDbtSliceColumnVar(String(dbtCfg.slice_column_var ?? ""));
      setPostTransformCode("");
    } else {
      setPostTransformType((pt?.type === "python" || pt?.type === "sql") ? pt.type : "");
      setPostTransformCode(typeof pt?.code === "string" ? pt.code : "");
      setDbtPackagePath("");
      setDbtDatasetName("");
      setDbtRepositoryBranch("");
      setDbtRunScope("all");
      setDbtSelector("");
      setDbtSliceValueVar("");
      setDbtSliceColumnVar("");
      setLinkedDbtProjectId(null);
    }
  }

  useEffect(() => {
    if (!effectiveOpenPipelineId) {
      lastOpenedFromUrlRef.current = null;
      return;
    }
    if (lastOpenedFromUrlRef.current === effectiveOpenPipelineId) return;
    lastOpenedFromUrlRef.current = effectiveOpenPipelineId;
    void startEdit(effectiveOpenPipelineId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- URL-driven open; avoid effect churn from startEdit identity
  }, [effectiveOpenPipelineId]);

  useEffect(() => {
    if (!editingId) {
      setPipelineMonitors([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/monitors", { credentials: "same-origin" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { monitors?: { name: string; type: string; pipeline_id: string }[] };
        const all = data.monitors ?? [];
        if (!cancelled) setPipelineMonitors(all.filter((m) => m.pipeline_id === editingId));
      } catch {
        /* monitors are optional context — ignore errors */
      }
    })();
    return () => { cancelled = true; };
  }, [editingId]);

  async function remove(id: string) {
    if (!confirm("Delete this connection?")) return;
    await fetch(`/api/elt/pipelines/${id}`, { method: "DELETE", credentials: "same-origin" });
    await load();
    if (detail?.id === id) setDetail(null);
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    await fetch(`/api/elt/pipelines/${id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    await load();
  }

  async function setDefaultGateway(pipelineId: string, tokenId: string) {
    await fetch(`/api/elt/pipelines/${pipelineId}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultTargetAgentTokenId: tokenId === "" ? null : tokenId,
      }),
    });
    await load();
  }

  async function patchPipelineExecutionHost(pipelineId: string, host: PipelineExecutionHost) {
    await fetch(`/api/elt/pipelines/${pipelineId}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionHost: host }),
    });
    await load();
  }

  async function openDetail(id: string) {
    const res = await fetch(`/api/elt/pipelines/${id}`, { credentials: "same-origin" });
    if (!res.ok) return;
    const data = await res.json();
    const p = data.pipeline;
    setDetail({
      id: p.id,
      tool: p.tool,
      pipelineCode: p.pipelineCode,
      configYaml: p.configYaml ?? null,
      workspaceYaml: p.workspaceYaml ?? null,
      name: p.name,
    });
  }

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto space-y-10">
      <div>
        <h1 className="text-left text-2xl font-bold text-slate-900 dark:text-white">Pipelines</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Define connections from sources to destinations. eltPulse handles the sync mechanics, stores your definitions
          in your workspace, and generates a deployment package you can run anywhere — on eltPulse infrastructure or
          your own. Logs and run metadata flow back to eltPulse either way so you keep full observability.
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          When you edit a pipeline, use <strong className="font-medium text-slate-600 dark:text-slate-300">Visual canvas</strong>{" "}
          next to Guided / JSON for the diagram, or open Canvas from the table row — same record as this form.
        </p>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your pipelines</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              className="inline-flex items-center gap-1 text-sm text-sky-600 hover:underline dark:text-sky-400"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              type="button"
              onClick={openNewPipeline}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              <Plus className="h-4 w-4" />
              New pipeline
            </button>
          </div>
        </div>
        {loading ? (
          <EltLoadingState className="mt-3" />
        ) : pipelines.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No pipelines yet"
            description="Use Quick start for a guided first pipeline, or browse 111+ connectors in the catalog."
            action={{ href: "/quick-start", label: "Quick start" }}
            secondaryAction={{ href: "/builder", label: "Open builder" }}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Route</th>
                  <th className="px-4 py-2 font-medium">Runs on</th>
                  <th className="px-4 py-2 font-medium">Default gateway</th>
                  <th className="px-4 py-2 font-medium">Enabled</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {pipelines.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{p.name}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {p.sourceType} → {p.destinationType}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={p.executionHost ?? "inherit"}
                        onChange={(e) =>
                          void patchPipelineExecutionHost(p.id, e.target.value as PipelineExecutionHost)
                        }
                        className="max-w-[200px] rounded border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                        aria-label={`Execution host for ${p.name}`}
                        title="Hybrid: inherit account plane, force eltPulse-managed, or force a customer gateway"
                      >
                        <option value="inherit">Inherit account</option>
                        <option value="eltpulse_managed">eltPulse-managed</option>
                        <option value="customer_gateway">Customer gateway</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      {gatewayOptions.length === 0 ? (
                        <span className="text-xs text-slate-500" title="Create named gateways on the Gateway page">
                          —
                        </span>
                      ) : (
                        <select
                          value={p.defaultTargetAgentTokenId ?? ""}
                          onChange={(e) => void setDefaultGateway(p.id, e.target.value)}
                          className="max-w-[160px] rounded border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                          aria-label={`Default gateway for ${p.name}`}
                        >
                          <option value="">Any gateway</option>
                          {gatewayOptions.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => toggleEnabled(p.id, p.enabled)}
                        className="rounded border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-600"
                      >
                        {p.enabled ? "yes" : "no"}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(p.id)}
                        className="mr-2 inline-flex items-center gap-1 text-slate-700 hover:underline dark:text-slate-300"
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </button>
                      <Link
                        href={`/builder/canvas?pipeline=${encodeURIComponent(p.id)}`}
                        className="mr-2 inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        <Workflow className="h-4 w-4" /> Canvas
                      </Link>
                      <Link
                        href={`/runs?pipeline=${encodeURIComponent(p.id)}`}
                        className="mr-2 inline-flex items-center gap-1 text-amber-700 hover:underline dark:text-amber-400"
                        title="Chronological run log (every slice attempt)"
                      >
                        <History className="h-4 w-4" /> Runs
                      </Link>
                      <Link
                        href={`/run-slices?pipeline=${encodeURIComponent(p.id)}`}
                        className="mr-2 inline-flex items-center gap-1 text-teal-700 hover:underline dark:text-teal-400"
                        title="Latest status per slice, gaps, and re-runs (Run slices coverage)"
                      >
                        <TableProperties className="h-4 w-4" /> Slices
                      </Link>
                      <button
                        type="button"
                        onClick={() => openDetail(p.id)}
                        className="mr-2 inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400"
                      >
                        <Code2 className="h-4 w-4" /> Export
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="inline-flex items-center gap-1 text-red-600 hover:underline dark:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showPipelineForm && (
      <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editingId ? "Edit pipeline" : "New pipeline"}
            </h2>
            {!editingId && (
              <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-600">
                <button
                  type="button"
                  onClick={() => setCreateMode("browse")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 ${createMode === "browse" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Browse sources
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode("ai")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 ${createMode === "ai" ? "bg-gradient-to-r from-teal-500 to-sky-500 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode("manual")}
                  className={`rounded-md px-3 py-1 ${createMode === "manual" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                >
                  Manual
                </button>
              </div>
            )}
            {wantDbtSetup && (editingId || createMode === "manual") ? (
              <div className="mb-4 w-full rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm dark:border-violet-900 dark:bg-violet-950/40">
                <p className="font-medium text-violet-900 dark:text-violet-100">Enable dbt on this pipeline</p>
                <p className="mt-1 text-violet-800 dark:text-violet-200">
                  Scroll to <strong>Post-load transform</strong>, choose <strong>dbt</strong>, link an existing{" "}
                  <Link href="/catalog/dbt" className="font-semibold underline">
                    workspace project
                  </Link>{" "}
                  or pick a package from the{" "}
                  <Link href="/catalog/transform-hub" className="font-semibold underline">
                    Transform hub
                  </Link>
                  , then save.
                </p>
              </div>
            ) : null}
            {/* Guided/JSON/Canvas tabs — shown for editing, or when in manual create mode */}
            {(editingId || createMode === "manual") && (
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-600">
              <button
                type="button"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(sourceJson || "{}") as Record<string, unknown>;
                    const { core, connection } = extractConnectionValues(
                      parsed,
                      sourceType,
                      destinationType
                    );
                    setSourceCfg(ensureGithubReposForForm(core));
                    setConnectionValues({
                      ...emptyConnectionValuesForTypes(sourceType, destinationType),
                      ...connection,
                    });
                  } catch {
                    setError("Fix JSON before switching to Guided");
                    return;
                  }
                  setError(null);
                  setFormMode("structured");
                }}
                className={`rounded-md px-3 py-1 ${formMode === "structured" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
              >
                Guided
              </button>
              <button
                type="button"
                onClick={() => {
                  if (formMode === "structured") {
                    const merged = mergeConnectionStrings(sourceCfg, connectionValues);
                    setSourceJson(JSON.stringify(merged, null, 2));
                  }
                  setFormMode("json");
                }}
                className={`rounded-md px-3 py-1 ${formMode === "json" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
              >
                JSON
              </button>
              <Link
                href={
                  editingId
                    ? `/builder/canvas?pipeline=${encodeURIComponent(editingId)}`
                    : "/builder/canvas"
                }
                className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Workflow className="h-3.5 w-3.5" aria-hidden />
                Visual canvas
              </Link>
              {editingId ? (
                <>
                  <Link
                    href={`/runs?pipeline=${encodeURIComponent(editingId)}`}
                    className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    title="Chronological run log"
                  >
                    <History className="h-3.5 w-3.5" aria-hidden />
                    Run history
                  </Link>
                  <Link
                    href={`/run-slices?pipeline=${encodeURIComponent(editingId)}`}
                    className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    title="Latest per slice, gaps, backfills"
                  >
                    <TableProperties className="h-3.5 w-3.5" aria-hidden />
                    Slices
                  </Link>
                </>
              ) : null}
            </div>
            )}
          </div>

          {editingId ? (
            <div className="mb-6">
              <PipelineRunPanel pipelineId={editingId} />
            </div>
          ) : null}

          {/* Browse sources panel — catalog wizard, default for new pipelines */}
          {!editingId && createMode === "browse" && (
            <SourceCatalogWizard
              onPipelineSaved={() => { void load(); setShowCreateForm(false); }}
            />
          )}

          {/* AI Builder panel */}
          {!editingId && createMode === "ai" && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-800 dark:bg-teal-900/10">
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
                Describe what you want to load and the AI will generate the pipeline. You can review and edit it before saving.
              </p>
              <AiPipelineAssistant
                onPipelineSaved={() => { void load(); setShowCreateForm(false); }}
                inline
              />
            </div>
          )}

          {(editingId || createMode === "manual") && (
          <>
          {formMode === "json" && schemaFields.length === 0 ? (
            <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-300">
              JSON mode includes connection keys you type in Guided. For the{" "}
              <strong className="font-medium text-slate-800 dark:text-slate-200">visual pipeline editor</strong>, use{" "}
              <Link
                href={
                  editingId
                    ? `/builder/canvas?pipeline=${encodeURIComponent(editingId)}`
                    : "/builder/canvas"
                }
                className="font-medium text-sky-600 underline hover:no-underline dark:text-sky-400"
              >
                Visual canvas
              </Link>
              .
            </p>
          ) : null}

          {formMode === "structured" && editingId && canvasGraph !== null ? (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <span className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400">⚠</span>
              <span>
                This pipeline has a <strong className="font-medium">canvas layout</strong>. Saving here will update the
                source configuration and may overwrite canvas-specific node positions. Use{" "}
                <Link
                  href={`/builder/canvas?pipeline=${encodeURIComponent(editingId)}`}
                  className="font-medium underline hover:no-underline"
                >
                  Visual canvas
                </Link>{" "}
                to edit the diagram directly.
              </span>
            </div>
          ) : null}

          <form onSubmit={createPipeline} className="space-y-3">
            {formMode === "structured" && (
              <>
                <FormAccordion
                  id="acc-pipeline"
                  title="Pipeline"
                  subtitle="Name, route, and description"
                  defaultOpen
                  badge={`${sourceType} → ${destinationType}`}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Name (snake_case)</span>
                      <input
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                        placeholder="github_issues_to_duckdb"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Source</span>
                      <div className="mt-1">
                        <ConnectorCombobox
                          options={SOURCE_OPTIONS}
                          value={sourceType}
                          onChange={(t) => {
                            setSourceType(t);
                            if (!editingId && showCreateForm) {
                              resetConnectorForNewSourceType(t, destinationType);
                            } else {
                              setSourceConnectionId(null);
                            }
                          }}
                          placeholder="Search sources…"
                        />
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Destination</span>
                      <div className="mt-1">
                        <ConnectorCombobox
                          options={DESTINATION_OPTIONS}
                          value={destinationType}
                          onChange={(d) => {
                            setDestinationType(d);
                            if (!editingId && showCreateForm) {
                              setConnectionValues(emptyConnectionValuesForTypes(sourceType, d));
                            }
                            setDestinationConnectionId(null);
                          }}
                          placeholder="Search destinations…"
                        />
                      </div>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Description (optional)
                      </span>
                      <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <CopyEnvButton values={connectionValues} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Fills from source + destination connection fields below (passwords / JSON blobs not saved server-side).
                    </span>
                  </div>
                </FormAccordion>

                <FormAccordion
                  id="acc-source"
                  title="Source"
                  subtitle="Extract settings and source-side connection"
                  defaultOpen
                >
                  <div className="mb-3">
                    <ConnectionPicker
                      connectionType="source"
                      connector={sourceType}
                      currentValues={connectionValues}
                      onSelect={({ id, config }) => {
                        setSourceConnectionId(id);
                        setConnectionValues((prev) => ({ ...prev, ...config }));
                      }}
                    />
                  </div>
                  <GuidedSourceBlock
                    sourceType={sourceType}
                    schemaFields={schemaFields}
                    sourceCfg={sourceCfg}
                    onSourceCfgChange={setSourceCfg}
                    connectionValues={connectionValues}
                    onConnectionPatch={patchConnection}
                    genericConnectorJson={
                      schemaFields.length === 0
                        ? { value: sourceJson, onChange: setSourceJson }
                        : undefined
                    }
                  />
                </FormAccordion>

                <FormAccordion
                  id="acc-destination"
                  title="Destination"
                  subtitle="Load target and warehouse connection"
                  defaultOpen
                >
                  <div className="mb-3">
                    <ConnectionPicker
                      connectionType="destination"
                      connector={destinationType}
                      currentValues={connectionValues}
                      onSelect={({ id, config }) => {
                        setDestinationConnectionId(id);
                        setConnectionValues((prev) => ({ ...prev, ...config }));
                      }}
                    />
                  </div>
                  <GuidedDestinationBlock
                    destinationType={destinationType}
                    sourceCfg={sourceCfg}
                    onSourceCfgChange={setSourceCfg}
                    connectionValues={connectionValues}
                    onConnectionPatch={patchConnection}
                  />
                  <div className="mt-4">
                    <CopyEnvButton values={connectionValues} />
                  </div>
                </FormAccordion>

                <FormAccordion
                  id="acc-transform"
                  title="Post-load transform"
                  subtitle="Optional dbt, Python, or SQL to run after ingest"
                  defaultOpen={wantDbtSetup}
                  badge={wantDbtSetup ? "dbt setup" : undefined}
                >
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Transform type
                      <select
                        value={postTransformType}
                        onChange={(e) => setPostTransformType(e.target.value as "" | "python" | "sql" | "dbt")}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                      >
                        <option value="">None</option>
                        <option value="dbt">dbt (post-load dbt run)</option>
                        <option value="python">Python script</option>
                        <option value="sql">SQL statements</option>
                      </select>
                    </label>
                    {postTransformType === "dbt" && (
                      <>
                        <DbtProjectPicker
                          value={linkedDbtProjectId}
                          pipelineId={editingId}
                          sourceSlug={sourceType}
                          onChange={(id, project) => {
                            setLinkedDbtProjectId(id);
                            if (project) applyLinkedDbtProject(project);
                          }}
                        />
                        <DbtConfigFields
                          sourceSlug={sourceType}
                          pipelineTool={resolvedTool}
                          pipelineId={editingId}
                          dbtProjectId={linkedDbtProjectId}
                          values={{
                          packagePath: dbtPackagePath,
                          datasetName: dbtDatasetName,
                          repositoryBranch: dbtRepositoryBranch,
                          runScope: dbtRunScope,
                          selector: dbtSelector,
                          sliceValueVar: dbtSliceValueVar,
                          sliceColumnVar: dbtSliceColumnVar,
                        }}
                        onChange={(patch) => {
                          if (patch.packagePath !== undefined) setDbtPackagePath(patch.packagePath);
                          if (patch.datasetName !== undefined) setDbtDatasetName(patch.datasetName);
                          if (patch.repositoryBranch !== undefined) setDbtRepositoryBranch(patch.repositoryBranch);
                          if (patch.runScope !== undefined) setDbtRunScope(patch.runScope);
                          if (patch.selector !== undefined) setDbtSelector(patch.selector);
                          if (patch.sliceValueVar !== undefined) setDbtSliceValueVar(patch.sliceValueVar);
                          if (patch.sliceColumnVar !== undefined) setDbtSliceColumnVar(patch.sliceColumnVar);
                        }}
                      />
                      </>
                    )}
                    {postTransformType === "python" && (
                      <>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Appended after <code className="font-mono">pipeline.run()</code>. Has access to{" "}
                          <code className="font-mono">pipeline</code>, <code className="font-mono">info</code>, and{" "}
                          <code className="font-mono">partition_key</code>.
                        </p>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                          Python script
                          <textarea
                            value={postTransformCode}
                            onChange={(e) => setPostTransformCode(e.target.value)}
                            rows={10}
                            spellCheck={false}
                            placeholder={"# e.g.\nprint(f'Loaded {info.loads_ids} load(s)')\n# any Python here — imports, function calls, etc."}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                          />
                        </label>
                      </>
                    )}
                    {postTransformType === "sql" && (
                      <>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Executed against the destination after load. Separate statements with{" "}
                          <code className="font-mono">;</code>. Use fully-qualified names (schema.table).
                        </p>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                          SQL statements
                          <textarea
                            value={postTransformCode}
                            onChange={(e) => setPostTransformCode(e.target.value)}
                            rows={10}
                            spellCheck={false}
                            placeholder={"-- e.g.\nCREATE OR REPLACE VIEW analytics.v_orders AS SELECT * FROM raw.orders;\nUPDATE analytics.summary SET updated_at = NOW();"}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                          />
                        </label>
                      </>
                    )}
                  </div>
                </FormAccordion>
              </>
            )}

            {formMode === "json" && (
              <label className="block rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Full source configuration (JSON)
                </span>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Includes connector fields and any non-sensitive connection keys. Passwords and large secrets are
                  removed on save.
                </p>
                <textarea
                  value={sourceJson}
                  onChange={(e) => setSourceJson(e.target.value)}
                  rows={14}
                  spellCheck={false}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </label>
            )}

            <FormAccordion id="acc-quality" title="Quality, triggers & schedule" subtitle="Tests, monitors, run slices, schedule">
              <div className="space-y-5">

                {/* Data tests */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Data tests (assertions)</label>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    One assertion per line — exported to workspace YAML. Example:{" "}
                    <code className="font-mono">row_count &gt; 0</code>,{" "}
                    <code className="font-mono">no_nulls: id</code>
                  </p>
                  <textarea
                    value={tests}
                    onChange={(e) => setTests(e.target.value)}
                    rows={3}
                    placeholder={"row_count > 0\nno_nulls: id\nunique: order_id"}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                {/* Triggers summary — live read-only overview with links to manage each type */}
                {editingId ? (
                  <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-900/10">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Triggers</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">what fires this pipeline</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {/* Cron */}
                      <div className="flex items-center justify-between gap-2 rounded border border-violet-200 bg-white px-2.5 py-1.5 dark:border-violet-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-medium text-violet-700 dark:text-violet-300 shrink-0">Cron</span>
                          <span className="truncate font-mono text-[11px] text-slate-600 dark:text-slate-400">
                            {scheduleEnabled && scheduleCron ? scheduleCron : <span className="italic text-slate-400 dark:text-slate-500">not set</span>}
                          </span>
                          {scheduleEnabled && scheduleCron && scheduleTimezone !== "UTC" ? (
                            <span className="shrink-0 text-[10px] text-slate-400">{scheduleTimezone}</span>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">edit below ↓</span>
                      </div>
                      {/* Incoming webhook */}
                      <div className="flex items-center justify-between gap-2 rounded border border-sky-200 bg-white px-2.5 py-1.5 dark:border-sky-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-sky-700 dark:text-sky-300 shrink-0">Webhook</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">incoming trigger URL</span>
                        </div>
                        <Link
                          href="/webhooks"
                          className="shrink-0 text-[10px] font-medium text-sky-600 hover:underline dark:text-sky-400"
                        >
                          Manage →
                        </Link>
                      </div>
                      {/* Monitors */}
                      <div className="rounded border border-teal-200 bg-white dark:border-teal-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-teal-700 dark:text-teal-300 shrink-0">Event monitors</span>
                            {pipelineMonitors.length === 0 ? (
                              <span className="italic text-[11px] text-slate-400 dark:text-slate-500">none linked</span>
                            ) : (
                              <span className="text-[11px] text-slate-600 dark:text-slate-400">{pipelineMonitors.length} linked</span>
                            )}
                          </div>
                          <Link
                            href="/orchestration"
                            className="shrink-0 text-[10px] font-medium text-teal-600 hover:underline dark:text-teal-400"
                          >
                            Manage →
                          </Link>
                        </div>
                        {pipelineMonitors.length > 0 ? (
                          <ul className="border-t border-teal-100 dark:border-teal-900 px-2.5 py-1.5 space-y-0.5">
                            {pipelineMonitors.map((m) => (
                              <li key={m.name} className="flex items-center gap-2 text-[11px]">
                                <span className="font-medium text-slate-700 dark:text-slate-300">{m.name}</span>
                                <span className="rounded bg-teal-100 px-1 font-mono text-[10px] text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                                  {m.type.replace(/_/g, " ")}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Run slices — intent + notes; partition column saved here when editing an existing pipeline */}
                <div className="rounded-lg border border-teal-100 bg-teal-50/60 p-3 dark:border-teal-900 dark:bg-teal-900/10">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Runs: full load or sliced?</span>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Choose how you plan to execute this pipeline. You can change this later. After you save the pipeline,
                        set the slice column and granularity below, or use{" "}
                        <Link
                          href={editingId ? `/run-slices?pipeline=${encodeURIComponent(editingId)}` : "/run-slices"}
                          className="font-medium text-teal-600 hover:underline dark:text-teal-400"
                        >
                          Run slices
                        </Link>{" "}
                        for partition-style coverage and backfills{editingId ? " (this pipeline)" : " across all pipelines"}.
                      </p>
                    </div>
                    <Link
                      href={editingId ? `/run-slices?pipeline=${encodeURIComponent(editingId)}` : "/run-slices"}
                      className="shrink-0 rounded border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:bg-slate-900 dark:text-teal-400"
                    >
                      {editingId ? "This pipeline →" : "All pipelines →"}
                    </Link>
                  </div>
                  <div className="mt-3 space-y-2">
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
                      <input
                        type="radio"
                        name="sliceIntent"
                        className="mt-0.5"
                        checked={sliceIntent === "full"}
                        onChange={() => setSliceIntent("full")}
                      />
                      <span>
                        <span className="font-medium">Full load each run</span>
                        <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">
                          Default. Each run loads everything this pipeline is configured to pull (no per-day / per-key
                          slice unless you add backfill runs later).
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
                      <input
                        type="radio"
                        name="sliceIntent"
                        className="mt-0.5"
                        checked={sliceIntent === "sliced"}
                        onChange={() => setSliceIntent("sliced")}
                      />
                      <span>
                        <span className="font-medium">Sliced loads (date or key)</span>
                        <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">
                          You plan separate runs per slice (e.g. one day at a time). Save the pipeline, then set the
                          partition column below (or on Run slices). Launch backfills from Run slices; your runner must honor{" "}
                          <code className="rounded bg-teal-100 px-0.5 text-[11px] dark:bg-teal-900/60">triggeredBy</code>{" "}
                          or custom code.
                        </span>
                      </span>
                    </label>
                  </div>
                  <label className="mt-3 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Notes <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    value={partitionsNote}
                    onChange={(e) => setPartitionsNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. date partition on event_date (daily, UTC); backfill from 2024-01-01"
                    className="mt-1 w-full rounded border border-teal-200 bg-white px-2 py-1.5 text-xs dark:border-teal-800 dark:bg-slate-900 dark:text-white"
                  />
                  {runSliceCapability.mode === "none_only" ? (
                    <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                      {runSliceCapability.detail}
                    </p>
                  ) : null}

                  {editingId ? (
                    <div className="mt-4 rounded-lg border border-teal-200/80 bg-white/80 p-3 dark:border-teal-800 dark:bg-slate-950/40">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Slice column &amp; granularity</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Saved to <code className="font-mono text-[11px]">sourceConfiguration._partitionConfig</code>. Use{" "}
                        <Link
                          href={`/run-slices?pipeline=${encodeURIComponent(editingId)}`}
                          className="text-teal-600 hover:underline dark:text-teal-400"
                        >
                          Run slices
                        </Link>{" "}
                        for backfills and latest-per-slice coverage.
                      </p>
                      <div className="mt-3">
                        <PartitionConfigEditor
                          key={editingId}
                          pipelineId={editingId}
                          sourceType={sourceType}
                          showBackfill={false}
                          onSaved={() => void load()}
                          onError={setError}
                        />
                      </div>
                      {runSliceCapability.mode !== "none_only" ? (
                        <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2.5 text-xs text-sky-950 dark:border-sky-800 dark:bg-sky-950/35 dark:text-sky-100">
                          <p className="font-semibold text-sky-900 dark:text-sky-200">From / To dates (missing days)</p>
                          <p className="mt-1 leading-relaxed text-sky-900/90 dark:text-sky-100/90">
                            They are <strong className="font-medium">not</strong> on this page. Open{" "}
                            <Link
                              href={`/run-slices?pipeline=${encodeURIComponent(editingId)}`}
                              className="font-medium text-sky-700 underline hover:no-underline dark:text-sky-300"
                            >
                              Run slices
                            </Link>
                            , choose this pipeline, then scroll to <strong className="font-medium">Day coverage</strong>{" "}
                            under <strong className="font-medium">Slice coverage</strong> — that is where quick ranges
                            (7/30/90 days), <strong className="font-medium">Fit to runs</strong>, and missing/failed counts
                            appear. With <strong className="font-medium">Date</strong> slices, you can also set default{" "}
                            <strong className="font-medium">From / To</strong> in <strong className="font-medium">Day coverage default range</strong>{" "}
                            below; those values are saved on the pipeline and pre-fill Run slices. Set{" "}
                            <strong className="font-medium">Slice type</strong> to <strong className="font-medium">Date</strong>, pick your partition column, and click{" "}
                            <strong className="font-medium">Save config</strong> first.
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-amber-800 dark:text-amber-200/90">
                          Day-by-day slice coverage in Run slices is limited for this source type; see the warning above.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      Save the pipeline once to configure slice column and granularity here.
                    </p>
                  )}
                </div>

                {/* Schedule */}
                <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-3 dark:border-violet-900 dark:bg-violet-900/10">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cron schedule</span>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Quick cron here is stored in the workspace YAML. For full schedule management (interval, daily, weekly, backfill-aware) use{" "}
                        <Link href="/schedule" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
                          Schedules
                        </Link>
                        .
                      </p>
                    </div>
                    <Link
                      href="/schedule"
                      className="shrink-0 rounded border border-violet-200 bg-white px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:bg-slate-900 dark:text-violet-400"
                    >
                      Manage →
                    </Link>
                  </div>
                  <div className="mt-2">
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={scheduleEnabled}
                        onChange={(e) => setScheduleEnabled(e.target.checked)}
                        className="rounded"
                      />
                      Enable cron in workspace YAML
                    </label>
                    {scheduleEnabled && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="block sm:col-span-2">
                          <span className="text-xs text-slate-500">Cron expression</span>
                          <input
                            value={scheduleCron}
                            onChange={(e) => setScheduleCron(e.target.value)}
                            placeholder="0 6 * * *"
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-900"
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-xs text-slate-500">Timezone</span>
                          <input
                            value={scheduleTimezone}
                            onChange={(e) => setScheduleTimezone(e.target.value)}
                            placeholder="UTC"
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Other notes */}
                <label className="block">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Other notes (SLAs, ownership, links)</span>
                  <textarea
                    value={otherNotes}
                    onChange={(e) => setOtherNotes(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  />
                </label>

              </div>
            </FormAccordion>

            <FormAccordion
              id="acc-webhook"
              title="Run webhook (optional)"
              subtitle="Per-pipeline run notifications"
            >
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Overrides the{" "}
                <Link href="/webhooks" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                  account default webhook
                </Link>{" "}
                for this pipeline only. Leave empty to inherit.
              </p>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Pipeline webhook URL</span>
                <input
                  value={pipelineWebhookUrl}
                  onChange={(e) => setPipelineWebhookUrl(e.target.value)}
                  placeholder="https://example.com/hooks/this-pipeline"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </label>
            </FormAccordion>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingId ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editingId ? "Save changes" : "Create pipeline"}
              </button>
              {(editingId || showCreateForm) && (
                <button
                  type="button"
                  onClick={() => (editingId ? cancelEdit() : cancelCreate())}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          </>
          )}
        </section>

        <aside className="hidden rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm lg:block dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-white">Tips</h3>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Use the <strong className="font-medium">Source</strong> and <strong className="font-medium">Destination</strong>{" "}
            panels to configure connection fields. Secrets and credentials are never saved to the server — set them as
            environment variables in your runner.
          </p>
          <p className="mt-4 text-xs text-slate-500">
            {SOURCE_TYPES.length} sources · {DESTINATION_TYPES.length} destinations in catalog.
          </p>
        </aside>
      </div>
      )}

      {detail && (
        <PipelineCodeModal
          tool={detail.tool}
          pipelineCode={detail.pipelineCode}
          configYaml={detail.configYaml}
          workspaceYaml={detail.workspaceYaml}
          pipelineName={detail.name}
          onClose={() => setDetail(null)}
        />
      )}

      <RelatedLinks links={[
        { href: "/runs", icon: Play, label: "Runs", desc: "Trigger and monitor pipeline executions with live telemetry" },
        { href: "/connections", icon: Plug, label: "Connections", desc: "Manage saved source and destination credentials" },
        { href: "/gateway", icon: Waypoints, label: "Gateway & execution", desc: "Configure where pipelines run" },
        { href: "/webhooks", icon: Webhook, label: "Webhooks", desc: "Get notified when runs reach a terminal state" },
      ]} />
    </div>
  );
}
