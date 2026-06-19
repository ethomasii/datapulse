"use client";

import { useMemo, useState } from "react";
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
import { minimalSourceConfigurationForNewPipeline } from "@/lib/elt/minimal-source-configuration";
import {
  QUICK_START_DESTINATIONS,
  QUICK_START_SOURCES,
  isQuickStartDestination,
  isQuickStartSource,
  normalizeQuickStartDestination,
  normalizeQuickStartSource,
} from "@/lib/elt/quick-start-catalog";
import {
  duckdbDestinationConfig,
  quickStartSecretFields,
} from "@/lib/elt/quick-start-credentials";
import { scenarioById, lakeStarterIdForScenario } from "@/lib/marketing/pipeline-scenarios";
import { canvasStarterHref } from "@/lib/elt/lake-defaults";

type Step = "destination" | "source" | "credentials" | "name" | "done";

const STEP_LABELS = ["Destination", "Source", "Credentials", "Run"];

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
  if (!initialSource || !initialDestination) return "destination";
  const dest = normalizeQuickStartDestination(initialDestination);
  const src = normalizeQuickStartSource(initialSource);
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
    : "duckdb";
  const normSource = initialSource ? normalizeQuickStartSource(initialSource) : "github";

  const [step, setStep] = useState<Step>(() => initialStep(initialSource, initialDestination));
  const [destination, setDestination] = useState(
    isQuickStartDestination(normDest) ? normDest : "duckdb"
  );
  const [source, setSource] = useState(isQuickStartSource(normSource) ? normSource : "github");
  const [pipelineName, setPipelineName] = useState("");
  const [destSecrets, setDestSecrets] = useState<Record<string, string>>({});
  const [sourceSecrets, setSourceSecrets] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdPipelineName, setCreatedPipelineName] = useState<string | null>(null);
  const [runTriggered, setRunTriggered] = useState(false);
  const scenarioStarterId = useMemo(() => {
    if (!scenarioId) return undefined;
    const scenario = scenarioById(scenarioId);
    return scenario ? lakeStarterIdForScenario(scenario) : undefined;
  }, [scenarioId]);
  const [executionLabel, setExecutionLabel] = useState<string | null>(null);

  const defaultName = `${source}_to_${destination}`.replace(/[^a-zA-Z0-9_]/g, "_");
  const effectiveName = pipelineName.trim() || defaultName;

  const destFields = quickStartSecretFields("destination", destination);
  const sourceFields = quickStartSecretFields("source", source);
  const needsCredentials = destFields.length > 0 || sourceFields.length > 0;

  const pipelineSourceType = useMemo(() => {
    if (source === "stripe") return "stripe_analytics";
    if (source === "shopify") return "shopify_dlt";
    return source;
  }, [source]);

  const stepIndex =
    step === "destination" ? 0 : step === "source" ? 1 : step === "credentials" ? 2 : step === "name" ? 3 : 4;

  async function testCredentials() {
    setTesting(true);
    setTestOk(null);
    setError(null);
    try {
      const tests = [];
      if (destFields.length > 0) {
        tests.push(
          fetch("/api/elt/connections/test", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              connectionType: "destination",
              connector: destination,
              config: destination === "duckdb" ? duckdbDestinationConfig() : {},
              secrets: destSecrets,
            }),
          })
        );
      }
      if (sourceFields.length > 0) {
        tests.push(
          fetch("/api/elt/connections/test", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              connectionType: "source",
              connector: source,
              config: {},
              secrets: sourceSecrets,
            }),
          })
        );
      }
      const results = await Promise.all(tests);
      for (const res of results) {
        const data = (await res.json()) as { ok?: boolean; message?: string };
        if (!data.ok) throw new Error(data.message ?? "Connection test failed");
      }
      setTestOk(true);
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
    secrets: Record<string, string>
  ): Promise<string> {
    const config = type === "destination" && connector === "duckdb" ? duckdbDestinationConfig() : {};
    const res = await fetch("/api/elt/connections", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        connectionType: type,
        connector,
        config,
        secrets: Object.keys(secrets).some((k) => secrets[k]?.trim()) ? secrets : undefined,
      }),
    });
    const data = (await res.json()) as { connection?: { id: string }; error?: string };
    if (!res.ok || !data.connection?.id) {
      throw new Error(typeof data.error === "string" ? data.error : "Failed to save connection");
    }
    return data.connection.id;
  }

  async function createAndRun() {
    setSaving(true);
    setError(null);
    try {
      let destConnId: string | null = null;
      let sourceConnId: string | null = null;

      if (needsCredentials) {
        destConnId = await createConnection(
          "destination",
          destination,
          `qs-${destination}`,
          destSecrets
        );
        sourceConnId = await createConnection("source", source, `qs-${source}`, sourceSecrets);
      }

      const res = await fetch("/api/elt/pipelines", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: effectiveName,
          sourceType: pipelineSourceType,
          destinationType: destination,
          tool: "auto",
          description: `Quick-start pipeline: ${source} → ${destination}`,
          sourceConfiguration: minimalSourceConfigurationForNewPipeline(pipelineSourceType),
          sourceConnectionId: sourceConnId,
          destinationConnectionId: destConnId,
        }),
      });
      const data = (await res.json()) as { pipeline?: { id: string }; error?: unknown };
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
            Connect credentials, create a pipeline, and run your first sync.
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
          {STEP_LABELS.map((label, i) => (
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

      {step === "destination" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Where should data land?</h2>
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
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{d.hint}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep("source")}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {step === "source" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">What are you syncing?</h2>
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
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep("destination")}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-400"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => {
                setPipelineName(defaultName);
                setStep(needsCredentials ? "credentials" : "name");
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
          {destFields.length > 0 ? (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase text-slate-500">Destination ({destination})</p>
              <div className="mt-3 space-y-2">
                {destFields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-xs text-slate-600 dark:text-slate-400">{f.label}</span>
                    <input
                      type="password"
                      value={destSecrets[f.key] ?? ""}
                      onChange={(e) => setDestSecrets((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {sourceFields.length > 0 ? (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase text-slate-500">Source ({source})</p>
              <div className="mt-3 space-y-2">
                {sourceFields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-xs text-slate-600 dark:text-slate-400">{f.label}</span>
                    <input
                      type="password"
                      value={sourceSecrets[f.key] ?? ""}
                      onChange={(e) => setSourceSecrets((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void testCredentials()}
            disabled={testing}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            {testing ? "Testing…" : "Test connections"}
          </button>
          {testOk === true ? (
            <p className="text-sm text-emerald-600">Connections look good.</p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-between">
            <button type="button" onClick={() => setStep("source")} className="text-sm text-slate-600">
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
            {source} → {destination}. Credentials are linked — ready to run.
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
              onClick={() => setStep(needsCredentials ? "credentials" : "source")}
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
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Pipeline created!</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {runTriggered
              ? `Sync started${executionLabel ? ` (${executionLabel})` : ""}. When load finishes, add transforms on the canvas.`
              : "Pipeline saved. Run ingest, then wire transforms with a lake recipe."}
          </p>
          {executionLabel === "Demo (stub)" ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Demo mode — configure GitHub Actions under Gateway for real pipeline runs.
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
                Add transforms
              </Link>
            ) : null}
            <Link
              href={createdId ? `/builder?pipeline=${encodeURIComponent(createdId)}` : "/builder"}
              className="inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Open in builder
            </Link>
            <Link
              href={createdId ? `/runs?pipeline=${encodeURIComponent(createdId)}` : "/runs"}
              className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-600"
            >
              View runs
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
