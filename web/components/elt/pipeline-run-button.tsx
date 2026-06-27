"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { DeploymentSelector } from "@/components/pipeline-canvas/deployment-selector";
import { DEFAULT_PIPELINE_RUN_ENVIRONMENT } from "@/lib/elt/pipeline-run-environment";
import { triggerPipelineRun } from "@/lib/elt/trigger-pipeline-run";

type Props = {
  pipelineId: string;
  pipelineName?: string;
  /** development or production — defaults to development. */
  environment?: string;
  /** When true, show a deployment picker next to the run button. */
  showEnvironmentPicker?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  /** When true, use compact link styling for table action rows. */
  inline?: boolean;
  /** After a successful trigger, navigate to the run detail on the Runs page. Default true. */
  openRunDetail?: boolean;
  className?: string;
};

export function PipelineRunButton({
  pipelineId,
  pipelineName,
  environment: environmentProp,
  showEnvironmentPicker = false,
  disabled = false,
  disabledReason,
  inline = false,
  openRunDetail = true,
  className = "",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [environment, setEnvironment] = useState(environmentProp ?? DEFAULT_PIPELINE_RUN_ENVIRONMENT);
  const runEnvironment = environmentProp ?? environment;

  async function onClick() {
    if (disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await triggerPipelineRun({ pipelineId, environment: runEnvironment });
      setLastRunId(id);
      if (openRunDetail) {
        router.push(
          `/runs?pipeline=${encodeURIComponent(pipelineId)}&run=${encodeURIComponent(id)}`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start run");
    } finally {
      setBusy(false);
    }
  }

  const title =
    disabled && disabledReason
      ? disabledReason
      : pipelineName
        ? `Run ${pipelineName}`
        : "Run pipeline";

  const label = busy ? "Starting…" : "Run";
  const buttonTitle = error ?? (disabled && disabledReason ? disabledReason : title);

  const baseClass = inline
    ? "inline-flex items-center gap-1 text-sky-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline dark:text-sky-400"
    : "inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50";

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      {showEnvironmentPicker ? (
        <DeploymentSelector value={runEnvironment} onChange={setEnvironment} />
      ) : null}
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={disabled || busy}
        title={buttonTitle}
        aria-label={title}
        className={baseClass}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
        {label}
      </button>
      {!inline && error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {!openRunDetail && lastRunId ? (
        <Link
          href={`/runs?pipeline=${encodeURIComponent(pipelineId)}&run=${encodeURIComponent(lastRunId)}`}
          className="mt-1 block text-xs text-sky-600 hover:underline dark:text-sky-400"
        >
          View run →
        </Link>
      ) : null}
    </span>
  );
}
