"use client";

import { useSearchParams } from "next/navigation";
import { BuilderClient } from "./builder-client";
import { CanvasPageClient } from "./canvas/canvas-page-client";

export function BuilderShellClient({ initialPipelineId }: { initialPipelineId: string | null }) {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "canvas" ? "canvas" : "form";
  const pipelineId =
    searchParams.get("pipeline")?.trim() || initialPipelineId?.trim() || null;

  if (view === "canvas" && pipelineId) {
    return <CanvasPageClient pipelineId={pipelineId} />;
  }

  return (
    <BuilderClient
      initialEditPipelineId={initialPipelineId}
      canvasPickHint={view === "canvas" && !pipelineId}
    />
  );
}
