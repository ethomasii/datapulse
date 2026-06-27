"use client";

import clsx from "clsx";
import type { CanvasInspectorFocus } from "@/components/pipeline-canvas/pipeline-canvas";
import { DataPreviewPane } from "@/components/pipeline-canvas/data-preview-pane";
import type { PipelineComponentSpec } from "@/lib/elt/declarative-pipeline-spec";
import {
  inputPreviewSourcesFromConfig,
  previewTableFromConfig,
} from "@/lib/elt/pipeline-asset-keys";

type Props = {
  pipelineId: string;
  focus: CanvasInspectorFocus;
  liveConfig?: Record<string, unknown> | null;
  className?: string;
  onInputDiagnosticChange?: (message: string | null) => void;
  onOutputDiagnosticChange?: (message: string | null) => void;
  throughStepId?: string | null;
  eltComponents?: PipelineComponentSpec[];
};

/** Lakeflow-style bottom strip — input vs output sample rows for the selected step. */
export function CanvasPreviewPanel({
  pipelineId,
  focus,
  liveConfig,
  className,
  onInputDiagnosticChange,
  onOutputDiagnosticChange,
  throughStepId = null,
  eltComponents,
}: Props) {
  if (focus.kind !== "component") {
    return (
      <section
        className={clsx(
          "flex shrink-0 items-center justify-center border-t border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/80",
          className ?? "h-52"
        )}
        aria-label="Data preview"
      >
        Select a native transform on the canvas to preview input and output rows.
      </section>
    );
  }

  const config = liveConfig ?? ((focus.data.config as Record<string, unknown>) ?? {});
  const inputSources = inputPreviewSourcesFromConfig(config);
  const inputTable = inputSources[0]?.table ?? null;
  const outputTable = previewTableFromConfig(config);

  return (
    <section
      className={clsx(
        "flex shrink-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
        className ?? "h-52"
      )}
      aria-label="Data preview"
    >
      <DataPreviewPane
        title="Input data preview"
        table={inputTable}
        inputSources={inputSources.length > 1 ? inputSources : undefined}
        pipelineId={pipelineId}
        config={config}
        onDiagnosticChange={onInputDiagnosticChange}
      />
      <DataPreviewPane
        title="Output data preview"
        table={outputTable}
        pipelineId={pipelineId}
        config={config}
        onDiagnosticChange={onOutputDiagnosticChange}
        fusedPreview
        throughStepId={throughStepId}
        eltComponents={eltComponents}
      />
    </section>
  );
}
