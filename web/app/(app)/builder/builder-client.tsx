"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Play, Plus, Trash2, Code2, RefreshCw, Pencil, Plug, Waypoints, Webhook, Workflow } from "lucide-react";
import { RelatedLinks } from "@/components/ui/related-links";
import {
  DESTINATION_GROUPS,
  SOURCE_GROUPS,
  DESTINATION_TYPES,
  SOURCE_TYPES,
} from "@/lib/elt/catalog";
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
  const [sensors, setSensors] = useState("");
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
    return next;
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
          sensors,
          sliceIntent,
          partitionsNote,
          otherNotes,
          scheduleEnabled,
          scheduleCron: scheduleCron || undefined,
          scheduleTimezone: scheduleTimezone || undefined,
          runsWebhookUrl: pipelineWebhookUrl,
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
        setSensors("");
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
    setSensors("");
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
    setSensors(eltLinesFromConfig("elt_sensors", cfg));
    const rawIntent = cfg.elt_slice_intent;
    setSliceIntent(rawIntent === "sliced" ? "sliced" : "full");
    setPartitionsNote(typeof cfg.elt_partitions_note === "string" ? cfg.elt_partitions_note : "");
    setOtherNotes(typeof cfg.elt_other_notes === "string" ? cfg.elt_other_notes : "");
    setScheduleEnabled(Boolean(cfg.schedule_enabled));
    setScheduleCron(typeof cfg.cron_schedule === "string" ? cfg.cron_schedule : "");
    setScheduleTimezone(typeof cfg.schedule_timezone === "string" ? cfg.schedule_timezone : "UTC");
    setPipelineWebhookUrl(typeof p.runsWebhookUrl === "string" ? p.runsWebhookUrl : "");
    setCanvasGraph(getCanvasFromSourceConfig(cfg));
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
    <div className="w-full min-w-0 space-y-10">
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
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-slate-600 dark:text-slate-300">No pipelines yet.</p>
            <button
              type="button"
              onClick={openNewPipeline}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              <Plus className="h-4 w-4" />
              Create your first pipeline
            </button>
          </div>
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
            </div>
          </div>
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
                      <select
                        value={sourceType}
                        onChange={(e) => {
                          const t = e.target.value;
                          setSourceType(t);
                          if (!editingId && showCreateForm) {
                            resetConnectorForNewSourceType(t, destinationType);
                          } else {
                            setSourceConnectionId(null);
                          }
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                      >
                        {Object.entries(SOURCE_GROUPS).map(([group, items]) => (
                          <optgroup key={group} label={group}>
                            {items.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Destination</span>
                      <select
                        value={destinationType}
                        onChange={(e) => {
                          const d = e.target.value;
                          setDestinationType(d);
                          if (!editingId && showCreateForm) {
                            setConnectionValues(emptyConnectionValuesForTypes(sourceType, d));
                          }
                          setDestinationConnectionId(null);
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                      >
                        {Object.entries(DESTINATION_GROUPS).map(([group, items]) => (
                          <optgroup key={group} label={group}>
                            {items.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
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

                {/* Monitors (pipeline notes) */}
                <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-900/10">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Event sensors</span>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Describe which sensors should trigger this pipeline. Managed in{" "}
                        <Link href="/orchestration" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                          Monitors
                        </Link>{" "}
                        — the live sensor engine is decoupled from the pipeline definition.
                      </p>
                    </div>
                    <Link
                      href="/orchestration"
                      className="shrink-0 rounded border border-sky-200 bg-white px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-400"
                    >
                      Manage →
                    </Link>
                  </div>
                  <textarea
                    value={sensors}
                    onChange={(e) => setSensors(e.target.value)}
                    rows={2}
                    placeholder="s3_landing_bucket_watch&#10;upstream_dbt_succeeded"
                    className="mt-2 w-full rounded border border-sky-200 bg-white px-2 py-1.5 font-mono text-xs dark:border-sky-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                {/* Run slices — intent + notes; detailed column/granularity on Run slices */}
                <div className="rounded-lg border border-teal-100 bg-teal-50/60 p-3 dark:border-teal-900 dark:bg-teal-900/10">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Runs: full load or sliced?</span>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Choose how you plan to execute this pipeline. You can change this later. Technical slice column and
                        backfills are configured on{" "}
                        <Link href="/run-slices" className="font-medium text-teal-600 hover:underline dark:text-teal-400">
                          Run slices
                        </Link>
                        .
                      </p>
                    </div>
                    <Link
                      href="/run-slices"
                      className="shrink-0 rounded border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:bg-slate-900 dark:text-teal-400"
                    >
                      Configure →
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
                          You plan separate runs per slice (e.g. one day at a time). Set the partition column and launch
                          backfills on Run slices; your runner must honor{" "}
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
