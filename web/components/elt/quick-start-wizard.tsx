"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import { ConnectorIcon } from "@/components/marketing/connector-icon";
import { CredentialFieldHelp } from "@/components/elt/credential-field-help";
import { ConnectorCombobox } from "@/components/elt/connector-combobox";
import { minimalSourceConfigurationForNewPipeline } from "@/lib/elt/minimal-source-configuration";
import {
  QUICK_START_DESTINATIONS,
  QUICK_START_SOURCES,
  allQuickStartDestinationComboboxOptions,
  allQuickStartSourceComboboxOptions,
  allQuickStartSourceOptions,
  isFeaturedQuickStartSource,
  isQuickStartDestination,
  isQuickStartSource,
  normalizeQuickStartDestination,
  normalizeQuickStartSource,
  quickStartConnectionConnector,
  quickStartDiscoverConnector,
  quickStartPipelineSourceType,
} from "@/lib/elt/quick-start-catalog";
import {
  duckdbDestinationConfig,
  quickStartDestinationConfig,
  quickStartSecretFields,
} from "@/lib/elt/quick-start-credentials";
import { STARTER_WAREHOUSE_DEFAULT_DB } from "@/lib/elt/starter-warehouse";
import { scenarioById, lakeStarterIdForScenario } from "@/lib/marketing/pipeline-scenarios";
import { canvasStarterHref } from "@/lib/elt/lake-defaults";
import { applyDiscoveryToSourceConfiguration, applyGithubRepoToSourceConfiguration } from "@/lib/elt/source-discover-catalog";
import { QuickStartConnectionPicker } from "@/components/elt/quick-start-connection-picker";
import { TablePicker, useGithubRepoDiscovery, useSourceDiscovery } from "@/components/elt/table-picker";
import {
  matchingQuickStartConnections,
  useQuickStartConnections,
} from "@/lib/hooks/use-quick-start-connections";
import { useWorkspaceDefaultDestination } from "@/lib/hooks/use-workspace-default-destination";
import { WorkspaceLakeBanner } from "@/components/elt/workspace-lake-banner";

type Step = "source" | "destination" | "credentials" | "repo" | "tables" | "name" | "done";

export type QuickStartWizardProps = {
  initialSource?: string;
  initialDestination?: string;
  scenarioId?: string;
  scenarioTitle?: string;
};

function initialStep(
  initialSource?: string,
  initialDestination?: string
): Step {
  if (!initialSource) return "source";
  const src = normalizeQuickStartSource(initialSource);
  if (!initialDestination) return "source";
  const dest = normalizeQuickStartDestination(initialDestination);
  const destFields = quickStartSecretFields("destination", dest);
  const sourceFields = quickStartSecretFields("source", src);
  if (destFields.length > 0 || sourceFields.length > 0) return "credentials";
  return "name";
}

export function QuickStartWizard({
  initialSource,
  initialDestination,
  scenarioId,
  scenarioTitle,
}: QuickStartWizardProps) {
  const normDest = initialDestination
    ? normalizeQuickStartDestination(initialDestination)
    : "motherduck";
  const normSource = initialSource ? normalizeQuickStartSource(initialSource) : "github";
  const resolvedInitialSource = isQuickStartSource(normSource) ? normSource : "github";

  const [step, setStep] = useState<Step>(() => initialStep(initialSource, initialDestination));
  const [destination, setDestination] = useState(
    isQuickStartDestination(normDest) ? normDest : "motherduck"
  );
  const [source, setSource] = useState(resolvedInitialSource);
  const [sourceSearch, setSourceSearch] = useState("");
  const [pipelineName, setPipelineName] = useState("");
  const [destSecrets, setDestSecrets] = useState<Record<string, string>>({});
  const [destConfig, setDestConfig] = useState<Record<string, string>>({
    database: STARTER_WAREHOUSE_DEFAULT_DB,
  });
  const [sourceSecrets, setSourceSecrets] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdPipelineName, setCreatedPipelineName] = useState<string | null>(null);
  const [pipelineWasUpdated, setPipelineWasUpdated] = useState(false);
  const [runTriggered, setRunTriggered] = useState(false);
  const scenarioStarterId = useMemo(() => {
    if (!scenarioId) return undefined;
    const scenario = scenarioById(scenarioId);
    return scenario ? lakeStarterIdForScenario(scenario) : undefined;
  }, [scenarioId]);
  const [executionLabel, setExecutionLabel] = useState<string | null>(null);
  const [discoverEnabled, setDiscoverEnabled] = useState(false);

  const workspaceDefault = useWorkspaceDefaultDestination();
  const { connections, loaded: connectionsLoaded } = useQuickStartConnections();
  const [sourceConnectionChoice, setSourceConnectionChoice] = useState<"reuse" | "new">("reuse");
  const [selectedSourceConnectionId, setSelectedSourceConnectionId] = useState<string | null>(
    null
  );
  const [destConnectionChoice, setDestConnectionChoice] = useState<"reuse" | "new">("reuse");
  const [selectedDestConnectionId, setSelectedDestConnectionId] = useState<string | null>(null);

  const hasExplicitDestination = Boolean(
    initialDestination &&
      isQuickStartDestination(normalizeQuickStartDestination(initialDestination))
  );
  const usingWorkspaceDest = Boolean(workspaceDefault.connectionId);
  const skipDestinationStep = usingWorkspaceDest && !hasExplicitDestination;

  useEffect(() => {
    if (!workspaceDefault.loaded || hasExplicitDestination || !workspaceDefault.connector) return;
    const normalized = normalizeQuickStartDestination(workspaceDefault.connector);
    setDestination(isQuickStartDestination(normalized) ? normalized : normalized);
  }, [
    workspaceDefault.loaded,
    workspaceDefault.connector,
    hasExplicitDestination,
  ]);

  const connectionSourceConnector = useMemo(() => quickStartConnectionConnector(source), [source]);

  const matchingSourceConnections = useMemo(
    () => matchingQuickStartConnections(connections, "source", connectionSourceConnector),
    [connections, connectionSourceConnector]
  );
  const matchingDestConnections = useMemo(
    () =>
      usingWorkspaceDest
        ? []
        : matchingQuickStartConnections(connections, "destination", destination),
    [connections, destination, usingWorkspaceDest]
  );

  useEffect(() => {
    if (!connectionsLoaded) return;
    if (matchingSourceConnections.length > 0) {
      setSelectedSourceConnectionId((prev) =>
        prev && matchingSourceConnections.some((c) => c.id === prev)
          ? prev
          : matchingSourceConnections[0].id
      );
      setSourceConnectionChoice("reuse");
    } else {
      setSourceConnectionChoice("new");
      setSelectedSourceConnectionId(null);
    }
  }, [connectionsLoaded, connectionSourceConnector, connections]);

  useEffect(() => {
    if (!connectionsLoaded || usingWorkspaceDest) return;
    if (matchingDestConnections.length > 0) {
      setSelectedDestConnectionId((prev) =>
        prev && matchingDestConnections.some((c) => c.id === prev)
          ? prev
          : matchingDestConnections[0].id
      );
      setDestConnectionChoice("reuse");
    } else {
      setDestConnectionChoice("new");
      setSelectedDestConnectionId(null);
    }
  }, [connectionsLoaded, destination, usingWorkspaceDest, connections]);

  const usingSavedSource =
    sourceConnectionChoice === "reuse" && Boolean(selectedSourceConnectionId);
  const usingSavedDest =
    !usingWorkspaceDest && destConnectionChoice === "reuse" && Boolean(selectedDestConnectionId);

  const pipelineSourceType = useMemo(() => quickStartPipelineSourceType(source), [source]);
  const isGithubQuickStart = pipelineSourceType === "github";
  const nextStepAfterCredentials = (): Step => (isGithubQuickStart ? "repo" : "tables");

  const discovery = useSourceDiscovery({
    connector: quickStartDiscoverConnector(source),
    secrets: usingSavedSource ? undefined : sourceSecrets,
    connectionId: usingSavedSource ? selectedSourceConnectionId : null,
    enabled: discoverEnabled && step === "tables",
  });

  const repoDiscovery = useGithubRepoDiscovery({
    secrets: usingSavedSource ? undefined : sourceSecrets,
    connectionId: usingSavedSource ? selectedSourceConnectionId : null,
    enabled: isGithubQuickStart && step === "repo",
  });

  const selectedGithubRepo = useMemo(() => Array.from(repoDiscovery.selected)[0] ?? "", [repoDiscovery.selected]);

  const allSourceOptions = useMemo(() => allQuickStartSourceOptions(), []);
  const sourceComboboxOptions = useMemo(() => allQuickStartSourceComboboxOptions(), []);
  const destComboboxOptions = useMemo(() => allQuickStartDestinationComboboxOptions(), []);

  const filteredBrowseSources = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase();
    const nonFeatured = allSourceOptions.filter((s) => !isFeaturedQuickStartSource(s.slug));
    if (!q) return nonFeatured;
    return nonFeatured.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.hint.toLowerCase().includes(q)
    );
  }, [allSourceOptions, sourceSearch]);

  const defaultName = `${source}_to_${destination}`.replace(/[^a-zA-Z0-9_]/g, "_");
  const effectiveName = pipelineName.trim() || defaultName;

  const destFieldDefs = usingWorkspaceDest
    ? []
    : quickStartSecretFields("destination", destination);
  const sourceFieldDefs = quickStartSecretFields("source", connectionSourceConnector);
  const needsSourceCredentials = sourceFieldDefs.length > 0 && !usingSavedSource;
  const needsDestCredentials = destFieldDefs.length > 0 && !usingSavedDest;
  const needsCredentials = needsSourceCredentials || needsDestCredentials;

  const sourceConnectorLabel =
    sourceComboboxOptions.find((o) => o.slug === source)?.label ?? source;
  const destConnectorLabel =
    destComboboxOptions.find((o) => o.slug === destination)?.label ?? destination;

  useEffect(() => {
    if (!connectionsLoaded || step !== "credentials") return;
    if (!needsCredentials) {
      setDiscoverEnabled(true);
      setStep(nextStepAfterCredentials());
    }
  }, [connectionsLoaded, step, needsCredentials, isGithubQuickStart]);

  const effectiveDestination =
    usingWorkspaceDest && workspaceDefault.connector
      ? normalizeQuickStartDestination(workspaceDefault.connector)
      : destination;

  const visibleStepLabels = useMemo(() => {
    const labels = ["Source"];
    if (!skipDestinationStep) labels.push("Destination");
    if (needsCredentials) labels.push("Credentials");
    if (isGithubQuickStart) labels.push("Repository");
    labels.push("Resources", "Run");
    return labels;
  }, [skipDestinationStep, needsCredentials, isGithubQuickStart]);

  const stepIndex = useMemo(() => {
    const order: Step[] = ["source"];
    if (!skipDestinationStep) order.push("destination");
    if (needsCredentials) order.push("credentials");
    if (isGithubQuickStart) order.push("repo");
    order.push("tables", "name", "done");
    const idx = order.indexOf(step);
    return idx >= 0 ? idx : order.length - 1;
  }, [step, skipDestinationStep, needsCredentials, isGithubQuickStart]);

  async function testCredentials() {
    setTesting(true);
    setTestOk(null);
    setError(null);
    try {
      const tests = [];
      if (needsDestCredentials) {
        tests.push(
          fetch("/api/elt/connections/test", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              connectionType: "destination",
              connector: destination,
              config: quickStartDestinationConfig(destination, destConfig),
              secrets: destSecrets,
            }),
          })
        );
      }
      if (needsSourceCredentials) {
        tests.push(
          fetch("/api/elt/connections/test", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              connectionType: "source",
              connector: connectionSourceConnector,
              config: {},
              secrets: sourceSecrets,
            }),
          })
        );
      }
      if (tests.length === 0) {
        setTestOk(true);
        setDiscoverEnabled(true);
        setStep(nextStepAfterCredentials());
        return;
      }
      const results = await Promise.all(tests);
      for (const res of results) {
        const data = (await res.json()) as { ok?: boolean; message?: string };
        if (!data.ok) throw new Error(data.message ?? "Connection test failed");
      }
      setTestOk(true);
      setDiscoverEnabled(true);
      setStep(nextStepAfterCredentials());
    } catch (e) {
      setTestOk(false);
      setError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function createConnection(
    type: "source" | "destination",
    connector: string,
    name: string,
    secrets: Record<string, string>,
    config: Record<string, unknown> = {}
  ): Promise<string> {
    const trimmedSecrets = Object.fromEntries(
      Object.entries(secrets).filter(([, v]) => typeof v === "string" && v.trim())
    );
    const resolvedConfig =
      type === "destination" && connector === "duckdb" && Object.keys(config).length === 0
        ? duckdbDestinationConfig()
        : config;

    const res = await fetch("/api/elt/connections", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        connectionType: type,
        connector,
        config: resolvedConfig,
        secrets: Object.keys(trimmedSecrets).length > 0 ? trimmedSecrets : undefined,
      }),
    });
    const data = (await res.json()) as { connection?: { id: string }; error?: string };
    if (res.ok && data.connection?.id) {
      return data.connection.id;
    }

    const errText = typeof data.error === "string" ? data.error : "";
    if (Object.keys(trimmedSecrets).length > 0) {
      const listRes = await fetch("/api/elt/connections", { credentials: "same-origin" });
      const listData = (await listRes.json()) as {
        connections?: { id: string; name: string; connectionType: string; connector: string }[];
      };
      const existing = (listData.connections ?? []).find(
        (c) =>
          c.name === name &&
          c.connectionType === type &&
          c.connector.toLowerCase() === connector.toLowerCase()
      );
      if (existing) {
        const patchRes = await fetch(`/api/elt/connections/${existing.id}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secrets: trimmedSecrets }),
        });
        const patchData = (await patchRes.json()) as { connection?: { id: string }; error?: string };
        if (patchRes.ok && patchData.connection?.id) {
          return patchData.connection.id;
        }
        throw new Error(
          typeof patchData.error === "string" ? patchData.error : "Failed to update saved connection"
        );
      }
    }

    throw new Error(errText || "Failed to save connection");
  }

  function assertQuickStartSecrets(
    fields: { key: string; required?: boolean }[],
    secrets: Record<string, string>,
    sideLabel: string
  ) {
    const missing = fields
      .filter((f) => f.required !== false)
      .map((f) => f.key)
      .filter((k) => !secrets[k]?.trim());
    if (missing.length > 0) {
      throw new Error(`Enter ${sideLabel} credentials (${missing.join(", ")}) before running.`);
    }
  }

  async function createAndRun() {
    setSaving(true);
    setError(null);
    try {
      let destConnId: string | null = usingWorkspaceDest ? workspaceDefault.connectionId : null;
      let sourceConnId: string | null = null;

      if (usingSavedSource && selectedSourceConnectionId) {
        sourceConnId = selectedSourceConnectionId;
      } else if (sourceFieldDefs.length > 0) {
        assertQuickStartSecrets(sourceFieldDefs, sourceSecrets, "source");
        sourceConnId = await createConnection(
          "source",
          connectionSourceConnector,
          `qs-${source}`,
          sourceSecrets
        );
      }
      if (usingSavedDest && selectedDestConnectionId) {
        destConnId = selectedDestConnectionId;
      } else if (destFieldDefs.length > 0) {
        assertQuickStartSecrets(destFieldDefs, destSecrets, "destination");
        destConnId = await createConnection(
          "destination",
          destination,
          `qs-${destination}`,
          destSecrets,
          quickStartDestinationConfig(destination, destConfig)
        );
        if (destConnId) {
          await fetch("/api/elt/workspace-defaults", {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ defaultDestinationConnectionId: destConnId }),
          });
        }
      }

      const baseConfig = minimalSourceConfigurationForNewPipeline(pipelineSourceType);
      if (isGithubQuickStart && !selectedGithubRepo) {
        throw new Error("Select a GitHub repository before running.");
      }
      const withRepo = isGithubQuickStart
        ? applyGithubRepoToSourceConfiguration(baseConfig, selectedGithubRepo)
        : baseConfig;
      const sourceConfiguration = applyDiscoveryToSourceConfiguration(
        pipelineSourceType,
        withRepo,
        Array.from(discovery.selected)
      );

      const res = await fetch("/api/elt/pipelines", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: effectiveName,
          sourceType: pipelineSourceType,
          destinationType: effectiveDestination,
          tool: "auto",
          description: `Quick-start pipeline: ${source} → ${effectiveDestination}`,
          sourceConfiguration,
          sourceConnectionId: sourceConnId,
          destinationConnectionId: destConnId,
          upsert: true,
        }),
      });
      const data = (await res.json()) as {
        pipeline?: { id: string };
        created?: boolean;
        error?: unknown;
      };
      if (!res.ok) {
        const errMsg =
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error ?? "Failed to create pipeline");
        throw new Error(errMsg);
      }
      const pipelineId = data.pipeline?.id;
      if (!pipelineId) throw new Error("Pipeline created but no id returned");
      setCreatedId(pipelineId);
      setCreatedPipelineName(effectiveName);
      setPipelineWasUpdated(data.created === false);

      const execRes = await fetch("/api/execution/mode", { credentials: "same-origin" });
      if (execRes.ok) {
        const exec = (await execRes.json()) as { label?: string };
        setExecutionLabel(exec.label ?? null);
      }

      const runRes = await fetch("/api/elt/runs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId,
          environment: "default",
          status: "pending",
          triggeredBy: "quick_start",
        }),
      });
      if (runRes.ok) setRunTriggered(true);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white">
          <Zap className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quick start</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Pick a source, land data in your warehouse, then design transforms on the canvas.
          </p>
        </div>
      </div>

      {scenarioTitle ? (
        <div className="mb-6 rounded-lg border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm dark:border-violet-900 dark:bg-violet-950/30">
          <p className="font-medium text-violet-950 dark:text-violet-100">
            Scenario: {scenarioTitle}
          </p>
          <p className="mt-1 text-xs text-violet-800/90 dark:text-violet-200/80">
            Source and destination are pre-filled{scenarioId ? ` (${scenarioId})` : ""}. Add credentials and run.
          </p>
        </div>
      ) : null}

      {step !== "done" && (
        <div className="mb-8 flex gap-2">
          {visibleStepLabels.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={`h-1 rounded-full ${
                  i <= stepIndex ? "bg-sky-600" : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
              <p className="mt-1 hidden text-[10px] text-slate-500 sm:block">{label}</p>
            </div>
          ))}
        </div>
      )}

      {step === "source" && (
        <section className="space-y-4">
          {skipDestinationStep && workspaceDefault.connector ? (
            <WorkspaceLakeBanner
              connector={workspaceDefault.connector}
              name={workspaceDefault.name}
            />
          ) : null}
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">What are you syncing?</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Popular picks below — or search all {allSourceOptions.length}+ sources from the pipeline catalog.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {QUICK_START_SOURCES.map((s) => (
              <li key={s.slug}>
                <button
                  type="button"
                  onClick={() => setSource(s.slug)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    source === s.slug
                      ? "border-sky-500 bg-sky-50 dark:border-sky-600 dark:bg-sky-950/30"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ConnectorIcon slug={s.slug} name={s.label} size={20} />
                    <span className="font-semibold text-slate-900 dark:text-white">{s.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.hint}</p>
                </button>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">All sources</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Same registry as the pipeline builder — type to filter, or pick from the list.
            </p>
            <div className="mt-3">
              <ConnectorCombobox
                options={sourceComboboxOptions}
                value={source}
                onChange={setSource}
                placeholder={`Search ${allSourceOptions.length} sources…`}
              />
            </div>
            {source && !isFeaturedQuickStartSource(source) ? (
              <p className="mt-2 text-xs text-sky-700 dark:text-sky-400">
                Selected: <span className="font-medium">{sourceComboboxOptions.find((o) => o.slug === source)?.label ?? source}</span>
              </p>
            ) : null}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
                Browse by name ({filteredBrowseSources.length} more)
              </summary>
              <div className="mt-2">
                <input
                  type="search"
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  placeholder="Filter list…"
                  className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
                <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                  {filteredBrowseSources.slice(0, 80).map((s) => (
                    <li key={s.slug}>
                      <button
                        type="button"
                        onClick={() => setSource(s.slug)}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-white dark:hover:bg-slate-900 ${
                          source === s.slug ? "bg-sky-100 dark:bg-sky-950/40" : ""
                        }`}
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200">{s.label}</span>
                        <span className="text-xs text-slate-400">{s.slug}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setPipelineName(defaultName);
                setDiscoverEnabled(true);
                if (skipDestinationStep) {
                  setStep(needsCredentials ? "credentials" : nextStepAfterCredentials());
                } else {
                  setStep("destination");
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {step === "destination" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Where should data land?</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            New here?{" "}
            <Link href="/starter-warehouse" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Set up a free MotherDuck starter warehouse
            </Link>{" "}
            first, or pick a destination below.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {QUICK_START_DESTINATIONS.map((d) => (
              <li key={d.slug}>
                <button
                  type="button"
                  onClick={() => setDestination(d.slug)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    destination === d.slug
                      ? "border-sky-500 bg-sky-50 dark:border-sky-600 dark:bg-sky-950/30"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ConnectorIcon slug={d.slug} name={d.label} size={20} />
                    <span className="font-semibold text-slate-900 dark:text-white">{d.label}</span>
                    {d.slug === "motherduck" ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{d.hint}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">All destinations</p>
            <div className="mt-2">
              <ConnectorCombobox
                options={destComboboxOptions}
                value={destination}
                onChange={setDestination}
                placeholder={`Search ${destComboboxOptions.length} destinations…`}
              />
            </div>
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep("source")}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-400"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => {
                setPipelineName(defaultName);
                setDiscoverEnabled(true);
                setStep(needsCredentials ? "credentials" : nextStepAfterCredentials());
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {step === "credentials" && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <KeyRound className="h-5 w-5 text-sky-600" /> Connect credentials
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Stored encrypted for managed runs. DuckDB-only setups can skip secrets on the destination.
          </p>
          {sourceFieldDefs.length > 0 ? (
            <QuickStartConnectionPicker
              side="source"
              connector={connectionSourceConnector}
              connectorLabel={sourceConnectorLabel}
              connections={matchingSourceConnections}
              mode={sourceConnectionChoice}
              selectedId={selectedSourceConnectionId}
              onModeChange={setSourceConnectionChoice}
              onSelectId={setSelectedSourceConnectionId}
            />
          ) : null}
          {needsSourceCredentials ? (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase text-slate-500">Source ({source})</p>
              <div className="mt-3 space-y-2">
                {sourceFieldDefs.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-xs text-slate-600 dark:text-slate-400">{f.label}</span>
                    <input
                      type="password"
                      value={sourceSecrets[f.key] ?? ""}
                      onChange={(e) => setSourceSecrets((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                    />
                    <CredentialFieldHelp help={f.help} helpUrl={f.helpUrl} />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {destFieldDefs.length > 0 ? (
            <QuickStartConnectionPicker
              side="destination"
              connector={destination}
              connectorLabel={destConnectorLabel}
              connections={matchingDestConnections}
              mode={destConnectionChoice}
              selectedId={selectedDestConnectionId}
              onModeChange={setDestConnectionChoice}
              onSelectId={setSelectedDestConnectionId}
            />
          ) : null}
          {needsDestCredentials ? (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase text-slate-500">Destination ({destination})</p>
              <div className="mt-3 space-y-2">
                {destination === "motherduck" ? (
                  <label className="block">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Database name</span>
                    <input
                      value={destConfig.database ?? STARTER_WAREHOUSE_DEFAULT_DB}
                      onChange={(e) => setDestConfig((p) => ({ ...p, database: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-950"
                    />
                  </label>
                ) : null}
                {destFieldDefs.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-xs text-slate-600 dark:text-slate-400">{f.label}</span>
                    <input
                      type="password"
                      value={destSecrets[f.key] ?? ""}
                      onChange={(e) => setDestSecrets((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                    />
                    <CredentialFieldHelp help={f.help} helpUrl={f.helpUrl} />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {needsSourceCredentials || needsDestCredentials ? (
            <button
              type="button"
              onClick={() => void testCredentials()}
              disabled={testing}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              {testing ? "Testing…" : "Test connections"}
            </button>
          ) : null}
          {testOk === true ? (
            <p className="text-sm text-emerald-600">Connections look good.</p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {usingWorkspaceDest && workspaceDefault.connector ? (
            <WorkspaceLakeBanner
              connector={workspaceDefault.connector}
              name={workspaceDefault.name}
              variant="compact"
            />
          ) : null}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(skipDestinationStep ? "source" : "destination")}
              className="text-sm text-slate-600"
            >
              <ArrowLeft className="inline h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => {
                setDiscoverEnabled(true);
                setStep(nextStepAfterCredentials());
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              {usingSavedSource || usingSavedDest ? "Continue with saved connection" : "Continue"}{" "}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {step === "repo" && isGithubQuickStart && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Which repository?</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Pick the GitHub repository to sync. We list repos your token can access.
          </p>
          <TablePicker
            items={repoDiscovery.items}
            selected={repoDiscovery.selected}
            onChange={repoDiscovery.setSelected}
            loading={repoDiscovery.loading}
            message={repoDiscovery.message}
            singleSelect
            emptyHint="Enter a valid GitHub token on the previous step, or type owner/repo below."
          />
          {repoDiscovery.error ? (
            <p className="text-sm text-amber-600">{repoDiscovery.error}</p>
          ) : null}
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Or enter owner/repo manually
            </span>
            <input
              type="text"
              value={selectedGithubRepo}
              onChange={(e) => repoDiscovery.setSelected(new Set([e.target.value.trim()]))}
              placeholder="my-org/my-repo"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() =>
                setStep(needsCredentials ? "credentials" : skipDestinationStep ? "source" : "destination")
              }
              className="text-sm text-slate-600"
            >
              <ArrowLeft className="inline h-4 w-4" /> Back
            </button>
            <button
              type="button"
              disabled={!selectedGithubRepo.trim()}
              onClick={() => {
                setDiscoverEnabled(true);
                setStep("tables");
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {step === "tables" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">What should we sync?</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Choose tables or resources from <strong>{source}</strong> — like Fivetran&apos;s schema selection.
          </p>
          <TablePicker
            items={discovery.items}
            selected={discovery.selected}
            onChange={discovery.setSelected}
            loading={discovery.loading}
            message={discovery.message}
            emptyHint="No live discovery for this source — recommended defaults will be used."
          />
          {discovery.error ? <p className="text-sm text-amber-600">{discovery.error}</p> : null}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() =>
                setStep(
                  isGithubQuickStart
                    ? "repo"
                    : needsCredentials
                      ? "credentials"
                      : skipDestinationStep
                        ? "source"
                        : "destination"
                )
              }
              className="text-sm text-slate-600"
            >
              <ArrowLeft className="inline h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => setStep("name")}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {step === "name" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Name your pipeline</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {source} → {effectiveDestination}. Credentials are linked — ready to run. Reusing an
            existing pipeline name updates that pipeline instead of creating a duplicate.
          </p>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Pipeline name</span>
            <input
              type="text"
              value={pipelineName || defaultName}
              onChange={(e) => setPipelineName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            />
          </label>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep("tables")}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-400"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => void createAndRun()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Create &amp; run
            </button>
          </div>
        </section>
      )}

      {step === "done" && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            {pipelineWasUpdated ? "Pipeline updated!" : "Pipeline created!"}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {runTriggered
              ? `Ingest started${executionLabel ? ` (${executionLabel})` : ""}. Open the canvas to add filters, joins, and marts — or link a dbt project for production.`
              : "Pipeline saved. Design transforms on the canvas or run ingest first."}
          </p>
          {executionLabel === "Demo" || executionLabel === "Demo (stub)" ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Demo mode — runs use sample telemetry until eltPulse managed compute is active on this environment.
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {createdId ? (
              <Link
                href={canvasStarterHref({
                  pipelineId: createdId,
                  starterId: scenarioStarterId,
                  pipelineName: createdPipelineName ?? undefined,
                })}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                Design in canvas
              </Link>
            ) : null}
            <Link
              href={createdId ? `/runs?pipeline=${encodeURIComponent(createdId)}` : "/runs"}
              className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-600"
            >
              View runs
            </Link>
            <Link
              href={createdId ? `/builder?pipeline=${encodeURIComponent(createdId)}` : "/builder"}
              className="inline-flex rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              YAML builder
            </Link>
          </div>
        </section>
      )}

      <p className="mt-8 text-center text-sm text-slate-500">
        <Link href="/dashboard" className="text-sky-600 hover:underline dark:text-sky-400">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
