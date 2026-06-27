/**
 * Analyze canvas pipeline SQL fusion — segments, materialized tables, storage estimate.
 */

import type { PipelineComponentSpec } from "@/lib/elt/declarative-pipeline-spec";
import { routeComponent } from "@/lib/elt/component-compile-router";
import { getComponentById } from "@/lib/elt/component-registry";
import { getNativeComponent, resolveNativeComponentId } from "./registry";
import { shouldMaterializeStep } from "./fuse-warehouse-sql";
import { isDataframeExecution } from "./definitions/_sql-helpers";
import { materializationLabel } from "./materialization-field";
import { componentOutputTable } from "./eltpulse-scratch";
import { compileNativePipelineComponents } from "./compile-pipeline-components";

export type FusionSegmentKind = "fused_sql" | "sql" | "python" | "other";

export type FusionSegment = {
  kind: FusionSegmentKind;
  stepIds: string[];
  labels: string[];
  componentIds: string[];
  outputTable: string | null;
  materialization: string;
  fusedStepCount?: number;
};

export type PipelineFusionAnalysis = {
  totalSteps: number;
  warehouseSteps: number;
  tablesWithoutFusion: number;
  tablesAtRun: number;
  scratchTables: number;
  segments: FusionSegment[];
  fusionWarnings: string[];
  summary: string;
};

function topoOrder(components: PipelineComponentSpec[]): PipelineComponentSpec[] {
  if (components.length <= 1) return components;
  const byId = new Map(components.map((c) => [c.id, c]));
  const indeg = new Map<string, number>();
  for (const c of components) indeg.set(c.id, 0);
  for (const c of components) {
    for (const dep of c.after ?? []) {
      if (byId.has(dep)) indeg.set(c.id, (indeg.get(c.id) ?? 0) + 1);
    }
  }
  const q = components.filter((c) => (indeg.get(c.id) ?? 0) === 0);
  const out: PipelineComponentSpec[] = [];
  while (q.length) {
    const c = q.shift()!;
    out.push(c);
    for (const other of components) {
      if ((other.after ?? []).includes(c.id)) {
        indeg.set(other.id, (indeg.get(other.id) ?? 0) - 1);
        if (indeg.get(other.id) === 0) q.push(other);
      }
    }
  }
  for (const c of components) {
    if (!out.some((x) => x.id === c.id)) out.push(c);
  }
  return out;
}

function stepLabel(spec: PipelineComponentSpec): string {
  const cfg = (spec.config ?? {}) as Record<string, unknown>;
  return String(cfg.label ?? cfg.template_id ?? spec.id);
}

function stepComponentId(spec: PipelineComponentSpec): string {
  const cfg = (spec.config ?? {}) as Record<string, unknown>;
  return String(cfg.template_id ?? cfg.component_id ?? spec.id);
}

export function buildFusionSegments(components: PipelineComponentSpec[]): FusionSegment[] {
  const ordered = topoOrder(components);
  const segments: FusionSegment[] = [];
  let sqlBuffer: PipelineComponentSpec[] = [];

  function flushSqlBuffer() {
    if (!sqlBuffer.length) return;
    const stepIds = sqlBuffer.map((s) => s.id);
    const labels = sqlBuffer.map(stepLabel);
    const componentIds = sqlBuffer.map(stepComponentId);
    const lastCfg = (sqlBuffer[sqlBuffer.length - 1]!.config ?? {}) as Record<string, unknown>;
    const outputTable = componentOutputTable(lastCfg);
    const materialization = materializationLabel(
      String(lastCfg.materialization ?? lastCfg.elt_materialization ?? "ephemeral")
    );
    segments.push({
      kind: sqlBuffer.length > 1 ? "fused_sql" : "sql",
      stepIds,
      labels,
      componentIds,
      outputTable,
      materialization,
      fusedStepCount: sqlBuffer.length,
    });
    sqlBuffer = [];
  }

  for (const spec of ordered) {
    const cfg = { ...(spec.config ?? {}), template_id: (spec.config as Record<string, unknown>)?.template_id ?? spec.id };
    const nativeId = resolveNativeComponentId(cfg as Record<string, unknown>) ?? spec.id;
    const native = getNativeComponent(nativeId);
    if (!native) {
      flushSqlBuffer();
      segments.push({
        kind: "other",
        stepIds: [spec.id],
        labels: [stepLabel(spec)],
        componentIds: [stepComponentId(spec)],
        outputTable: componentOutputTable(cfg as Record<string, unknown>),
        materialization: "—",
      });
      continue;
    }

    const out = native.compile(cfg as Record<string, unknown>);
    if (out.python?.length) {
      flushSqlBuffer();
      segments.push({
        kind: "python",
        stepIds: [spec.id],
        labels: [stepLabel(spec)],
        componentIds: [nativeId],
        outputTable: componentOutputTable(cfg as Record<string, unknown>),
        materialization: materializationLabel(
          String((cfg as Record<string, unknown>).materialization ?? "ephemeral")
        ),
      });
      continue;
    }

    if (out.sql?.length && !isDataframeExecution(cfg as Record<string, unknown>)) {
      sqlBuffer.push(spec);
      if (shouldMaterializeStep(cfg as Record<string, unknown>)) {
        flushSqlBuffer();
      }
      continue;
    }

    flushSqlBuffer();
    segments.push({
      kind: "other",
      stepIds: [spec.id],
      labels: [stepLabel(spec)],
      componentIds: [nativeId],
      outputTable: componentOutputTable(cfg as Record<string, unknown>),
      materialization: "—",
    });
  }

  flushSqlBuffer();
  return segments;
}

export function analyzePipelineFusion(
  sourceConfiguration: Record<string, unknown>,
  opts?: { pipelineName?: string }
): PipelineFusionAnalysis {
  const raw = sourceConfiguration.elt_components;
  const components = Array.isArray(raw) ? (raw as PipelineComponentSpec[]) : [];
  const ordered = topoOrder(components);

  let warehouseSteps = 0;
  for (const spec of ordered) {
    const cfg = (spec.config ?? {}) as Record<string, unknown>;
    const cid = String(cfg.template_id ?? spec.id);
    const cat = getComponentById(cid)?.category ?? "transformation";
    const route = routeComponent(cid, cat);
    if (route.target === "warehouse") warehouseSteps += 1;
  }

  const segments = buildFusionSegments(ordered);
  const { result } = compileNativePipelineComponents(sourceConfiguration);
  const fusionWarnings = result.warnings.filter((w) => w.includes("Fused"));

  const scratchTables = segments.filter(
    (s) =>
      s.kind !== "python" &&
      s.outputTable &&
      s.materialization.startsWith("Ephemeral") &&
      s !== segments[segments.length - 1]
  ).length;

  const ctasAtRun = result.sqlStatements.filter((s) =>
    /CREATE\s+(OR\s+REPLACE\s+)?TABLE/i.test(s)
  ).length;
  const tablesAtRun = ctasAtRun;
  const tablesWithoutFusion = warehouseSteps;

  const saved = Math.max(0, tablesWithoutFusion - tablesAtRun);
  const summary =
    saved > 0
      ? `${saved} fewer table${saved === 1 ? "" : "s"} at run (${tablesWithoutFusion} steps → ${tablesAtRun} CTAS).`
      : tablesAtRun === 0
        ? "No warehouse SQL steps to fuse."
        : `${tablesAtRun} table${tablesAtRun === 1 ? "" : "s"} materialized at run.`;

  return {
    totalSteps: ordered.length,
    warehouseSteps,
    tablesWithoutFusion,
    tablesAtRun,
    scratchTables,
    segments,
    fusionWarnings,
    summary,
  };
}
