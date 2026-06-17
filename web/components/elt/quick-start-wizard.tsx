"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import { minimalSourceConfigurationForNewPipeline } from "@/lib/elt/minimal-source-configuration";

const DESTINATIONS = [
  { slug: "duckdb", label: "DuckDB", hint: "Local file — great for trying eltPulse" },
  { slug: "postgres", label: "PostgreSQL", hint: "Self-hosted or Neon" },
  { slug: "snowflake", label: "Snowflake", hint: "Cloud warehouse" },
  { slug: "bigquery", label: "BigQuery", hint: "Google Cloud" },
];

const SOURCES = [
  { slug: "github", label: "GitHub", hint: "Issues, PRs, repos" },
  { slug: "stripe", label: "Stripe", hint: "Customers, charges, products" },
  { slug: "rest_api", label: "REST API", hint: "Any HTTP JSON API" },
  { slug: "postgres", label: "PostgreSQL", hint: "Database replication" },
];

type Step = "destination" | "source" | "name" | "done";

export function QuickStartWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("destination");
  const [destination, setDestination] = useState("duckdb");
  const [source, setSource] = useState("github");
  const [pipelineName, setPipelineName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [runTriggered, setRunTriggered] = useState(false);

  const defaultName = `${source}_to_${destination}`.replace(/[^a-zA-Z0-9_]/g, "_");
  const effectiveName = pipelineName.trim() || defaultName;

  async function createAndRun() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/elt/pipelines", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: effectiveName,
          sourceType: source,
          destinationType: destination,
          tool: "auto",
          description: `Quick-start pipeline: ${source} → ${destination}`,
          sourceConfiguration: minimalSourceConfigurationForNewPipeline(source),
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

  const stepIndex = step === "destination" ? 0 : step === "source" ? 1 : step === "name" ? 2 : 3;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white">
          <Zap className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quick start</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Create and run your first pipeline in under a minute.
          </p>
        </div>
      </div>

      {step !== "done" && (
        <div className="mb-8 flex gap-2">
          {["Destination", "Source", "Name"].map((label, i) => (
            <div
              key={label}
              className={`h-1 flex-1 rounded-full ${
                i <= stepIndex ? "bg-sky-600" : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
      )}

      {step === "destination" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Where should data land?</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {DESTINATIONS.map((d) => (
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
                    <Database className="h-4 w-4 text-sky-600" aria-hidden />
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
            {SOURCES.map((s) => (
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
                  <span className="font-semibold text-slate-900 dark:text-white">{s.label}</span>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.hint}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep("destination")}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => {
                setPipelineName(defaultName);
                setStep("name");
              }}
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
            {source} → {destination}. You can add credentials and tune config in the builder after.
          </p>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Pipeline name</span>
            <input
              type="text"
              value={pipelineName || defaultName}
              onChange={(e) => setPipelineName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
            />
          </label>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
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
              onClick={() => void createAndRun()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
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
              ? "Your first sync is running on eltPulse-managed workers. Watch live telemetry below."
              : "Pipeline saved. Trigger a run from the builder when you're ready."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
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
