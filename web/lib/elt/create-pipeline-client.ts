import { minimalSourceConfigurationForNewPipeline } from "@/lib/elt/minimal-source-configuration";
import {
  minimalTransformOnlySourceConfiguration,
  transformOnlyCanvasGraph,
} from "@/lib/elt/pipeline-mode";

export function formatCreatePipelineApiError(data: Record<string, unknown>): string {
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

export type CreateEltPipelineInput = {
  name: string;
  sourceType: string;
  destinationType: string;
  destinationConnectionId?: string | null;
};

export type CreateTransformOnlyPipelineInput = {
  name: string;
  sourceTable: string;
  destinationType: string;
  destinationConnectionId: string;
  warehouseName?: string | null;
};

export async function createEltPipeline(input: CreateEltPipelineInput): Promise<string | undefined> {
  const sourceConfiguration = minimalSourceConfigurationForNewPipeline(input.sourceType);
  const res = await fetch("/api/elt/pipelines", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      sourceType: input.sourceType,
      destinationType: input.destinationType,
      tool: "auto",
      sourceConfiguration,
      ...(input.destinationConnectionId ? { destinationConnectionId: input.destinationConnectionId } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(formatCreatePipelineApiError(data));
  const pipeline = data.pipeline as { id?: string } | undefined;
  return pipeline?.id;
}

export async function createTransformOnlyPipeline(
  input: CreateTransformOnlyPipelineInput
): Promise<string | undefined> {
  const sourceTable = input.sourceTable.trim() || "staging.events";
  const warehouseLabel = input.warehouseName
    ? `${input.warehouseName} (${input.destinationType})`
    : `Default warehouse · ${input.destinationType}`;
  const canvas = transformOnlyCanvasGraph({ warehouseLabel, sourceTable });
  const sourceConfiguration = minimalTransformOnlySourceConfiguration(sourceTable, canvas);
  const res = await fetch("/api/elt/pipelines", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      sourceType: input.destinationType,
      destinationType: input.destinationType,
      tool: "auto",
      sourceConfiguration,
      destinationConnectionId: input.destinationConnectionId,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(formatCreatePipelineApiError(data));
  const pipeline = data.pipeline as { id?: string } | undefined;
  return pipeline?.id;
}
