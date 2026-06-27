/**
 * Build fused SELECT for canvas preview (no CTAS / no intermediate tables).
 */

import type { PipelineComponentSpec } from "@/lib/elt/declarative-pipeline-spec";
import { getNativeComponent, resolveNativeComponentId } from "./registry";
import {
  canChainCtas,
  ctasToSelectSql,
  flushFusedSqlSegment,
  fuseCtasChain,
  isFusibleCtasStatement,
  parseCtasStatement,
  shouldMaterializeStep,
} from "./fuse-warehouse-sql";
import { isDataframeExecution } from "./definitions/_sql-helpers";
import { componentOutputTable } from "./eltpulse-scratch";

function topoThroughStep(
  components: PipelineComponentSpec[],
  throughStepId: string
): PipelineComponentSpec[] {
  const byId = new Map(components.map((c) => [c.id, c]));
  if (!byId.has(throughStepId)) return components;

  const needed = new Set<string>([throughStepId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of components) {
      if (!needed.has(c.id)) continue;
      for (const dep of c.after ?? []) {
        if (byId.has(dep) && !needed.has(dep)) {
          needed.add(dep);
          changed = true;
        }
      }
    }
  }

  const indeg = new Map<string, number>();
  for (const id of Array.from(needed)) indeg.set(id, 0);
  for (const c of components) {
    if (!needed.has(c.id)) continue;
    for (const dep of c.after ?? []) {
      if (needed.has(dep)) indeg.set(c.id, (indeg.get(c.id) ?? 0) + 1);
    }
  }
  const q = Array.from(needed).filter((id) => (indeg.get(id) ?? 0) === 0);
  const out: PipelineComponentSpec[] = [];
  while (q.length) {
    const id = q.shift()!;
    const c = byId.get(id);
    if (c) out.push(c);
    for (const other of components) {
      if (!needed.has(other.id)) continue;
      if ((other.after ?? []).includes(id)) {
        indeg.set(other.id, (indeg.get(other.id) ?? 0) - 1);
        if (indeg.get(other.id) === 0) q.push(other.id);
      }
    }
  }
  return out;
}

export type FusedPreviewResult = {
  sql: string;
  outputTable: string | null;
  fusedSteps: number;
  message?: string;
};

/** Compile subgraph through `throughStepId` into one SELECT (preview-only). */
export function buildFusedPreviewSelect(
  components: PipelineComponentSpec[],
  throughStepId: string,
  limit = 25
): FusedPreviewResult | null {
  const slice = topoThroughStep(components, throughStepId);
  const sqlSegment: string[] = [];

  for (const spec of slice) {
    const cfg = {
      ...(spec.config ?? {}),
      template_id: (spec.config as Record<string, unknown>)?.template_id ?? spec.id,
    } as Record<string, unknown>;
    const nativeId = resolveNativeComponentId(cfg) ?? spec.id;
    const native = getNativeComponent(nativeId);
    if (!native) continue;

    const out = native.compile(cfg);
    if (out.python?.length) {
      return {
        sql: "",
        outputTable: componentOutputTable(cfg),
        fusedSteps: 0,
        message: "Preview stops before Python/LLM steps — showing last warehouse table if wired.",
      };
    }

    if (!out.sql?.length || isDataframeExecution(cfg)) continue;

    for (const stmt of out.sql) {
      if (!isFusibleCtasStatement(stmt)) return null;
      if (sqlSegment.length) {
        const prev = parseCtasStatement(sqlSegment[sqlSegment.length - 1]!);
        const next = parseCtasStatement(stmt);
        if (!prev || !next || !canChainCtas(prev, next)) {
          const flushed = flushFusedSqlSegment(sqlSegment);
          const select = ctasToSelectSql(flushed.statements[flushed.statements.length - 1] ?? "", limit);
          if (select) return { sql: select, outputTable: componentOutputTable(cfg), fusedSteps: sqlSegment.length };
          sqlSegment.length = 0;
        }
      }
      sqlSegment.push(stmt);
      if (shouldMaterializeStep(cfg) && spec.id === throughStepId) break;
    }

    if (spec.id === throughStepId) break;
  }

  if (!sqlSegment.length) return null;

  const { statements } = flushFusedSqlSegment(sqlSegment);
  const ctas = statements[0]!;
  const fused = sqlSegment.length > 1 ? fuseCtasChain(sqlSegment) ?? ctas : ctas;
  const select = ctasToSelectSql(fused, limit);
  if (!select) return null;

  const lastSpec = slice[slice.length - 1];
  const lastCfg = (lastSpec?.config ?? {}) as Record<string, unknown>;
  return {
    sql: select,
    outputTable: componentOutputTable(lastCfg),
    fusedSteps: sqlSegment.length,
  };
}

export function specIdFromCanvasNodeData(data: Record<string, unknown>): string {
  return String(data.label ?? data.componentId ?? "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^[^a-zA-Z]/, "c_")
    .slice(0, 128);
}
