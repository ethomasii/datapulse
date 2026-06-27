/**
 * Propagate upstream warehouse table refs when wiring canvas edges (Alteryx auto-input).
 */
import type { Edge, Node } from "@xyflow/react";
import { previewTableFromConfig } from "@/lib/elt/pipeline-asset-keys";
import {
  isRouterComponentId,
  outputTableForRouterPort,
} from "@/lib/elt/router-routes";
import { remapStalePipelineTableRef } from "@/lib/elt/pipeline-assets";
import { stripDuckdbCatalogPrefix } from "@/lib/elt/duckdb-table-ref";

export type WireInputContext = {
  /** Raw landing tables from pipeline source config (github issues, etc.). */
  rawLandingTables?: string[];
  /** dlt landing schema/dataset for this pipeline (e.g. github_owner_repo). */
  landingDataset?: string;
  /** Pipeline display name — used to fix stale schema refs from autofill. */
  pipelineName?: string;
};

/** Walk through Output nodes to the real data producer (Source or transform). */
export function expandUpstreamSources(nodes: Node[], edges: Edge[], nodeId: string): Node[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return [];

  if (node.type === "destNode") {
    const incoming = edges.filter((e) => e.target === nodeId);
    if (!incoming.length) {
      return [node];
    }
    return incoming.flatMap((e) => expandUpstreamSources(nodes, edges, e.source));
  }

  return [node];
}

function landingTablesFromContext(ctx?: WireInputContext): string[] {
  return (ctx?.rawLandingTables ?? []).map((t) => t.trim()).filter(Boolean);
}

function outputTableFromNode(
  node: Node,
  ctx?: WireInputContext,
  sourceHandle?: string | null
): string | null {
  if (node.type === "sourceNode" || node.type === "destNode") {
    const landing = landingTablesFromContext(ctx);
    return landing[0] ?? null;
  }
  if (node.type === "transformNode") return null;
  if (node.type === "componentNode") {
    const data = node.data as { componentId?: string; config?: Record<string, unknown> };
    const cfg = data?.config ?? {};
    const componentId = String(data.componentId ?? cfg.template_id ?? "");
    if (isRouterComponentId(componentId)) {
      const branch = outputTableForRouterPort(cfg, sourceHandle ?? undefined);
      if (branch) return branch;
    }
    return previewTableFromConfig(cfg);
  }
  return null;
}

/** Resolve warehouse table ref(s) produced by an upstream node (stops at Destination — post-load boundary). */
export function resolveOutputTablesFromNode(
  nodes: Node[],
  edges: Edge[],
  nodeId: string,
  ctx?: WireInputContext,
  sourceHandle?: string | null
): string[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return [];

  if (node.type === "destNode" || node.type === "sourceNode") {
    const out = outputTableFromNode(node, ctx, sourceHandle);
    return out ? [out] : [];
  }

  if (node.type === "componentNode") {
    const out = outputTableFromNode(node, ctx, sourceHandle);
    if (out) return [out];
    return expandUpstreamSources(nodes, edges, nodeId).flatMap((n) => {
      const t = outputTableFromNode(n, ctx, sourceHandle);
      return t ? [t] : [];
    });
  }

  return expandUpstreamSources(nodes, edges, nodeId).flatMap((n) => {
    const t = outputTableFromNode(n, ctx, sourceHandle);
    return t ? [t] : [];
  });
}

function collectUpstreamTables(
  nodes: Node[],
  edges: Edge[],
  targetNodeId: string,
  ctx?: WireInputContext
): string[] {
  const incoming = edges.filter((e) => e.target === targetNodeId);
  const tables: string[] = [];
  for (const edge of incoming) {
    for (const out of resolveOutputTablesFromNode(
      nodes,
      edges,
      edge.source,
      ctx,
      edge.sourceHandle
    )) {
      if (out && !tables.includes(out)) tables.push(out);
    }
  }
  return tables;
}

/** Prefer Destination over Source when ingest backbone exists (transforms read landed warehouse data). */
export function preferDestinationWireEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const source = nodes.find((n) => n.type === "sourceNode");
  const dest = nodes.find((n) => n.type === "destNode");
  if (!source || !dest) return edges;

  const hasBackbone = edges.some((e) => e.source === source.id && e.target === dest.id);
  if (!hasBackbone) return edges;

  const componentIds = nodes.filter((n) => n.type === "componentNode").map((n) => n.id);
  let next = edges;

  for (const compId of componentIds) {
    const incoming = next.filter((e) => e.target === compId);
    const fromDest = incoming.some((e) => e.source === dest.id);
    const fromSourceOnly = incoming.some((e) => e.source === source.id) && !fromDest;
    if (!fromSourceOnly) continue;

    next = next.filter((e) => !(e.target === compId && e.source === source.id));
    if (!next.some((e) => e.source === dest.id && e.target === compId)) {
      next = [
        ...next,
        {
          id: `e-${dest.id}-${compId}-rewire`,
          source: dest.id,
          target: compId,
          animated: true,
        },
      ];
    }
  }

  return next;
}

/** Patch target component config with upstream table ref after a new edge. */
export function wireInputFromUpstreamEdge(
  nodes: Node[],
  edges: Edge[],
  targetNodeId: string,
  ctx?: WireInputContext
): { nodeId: string; configPatch: Record<string, unknown> } | null {
  const target = nodes.find((n) => n.id === targetNodeId);
  if (!target || target.type !== "componentNode") return null;

  const upstreamTables = collectUpstreamTables(nodes, edges, targetNodeId, ctx);
  if (!upstreamTables.length) return null;

  const incoming = edges.filter((e) => e.target === targetNodeId);
  const existing = ((target.data as { config?: Record<string, unknown> })?.config ?? {}) as Record<
    string,
    unknown
  >;
  const primary = upstreamTables[0]!;
  const patch: Record<string, unknown> = { ...existing };

  const tableEmpty = !String(patch.table ?? "").trim();
  const wasAutofill = Boolean(patch._wire_autofill_at);
  let changed = false;

  function maybeRemapField(key: string) {
    const raw = stripDuckdbCatalogPrefix(String(patch[key] ?? "").trim());
    if (!raw || !ctx?.landingDataset || !ctx?.pipelineName) return;
    const remapped = remapStalePipelineTableRef(raw, ctx.pipelineName, ctx.landingDataset);
    if (remapped !== raw) {
      patch[key] = remapped;
      changed = true;
    }
  }

  if (tableEmpty || wasAutofill) {
    patch.table = primary;
    patch.input_table = primary;
    patch.input_asset_keys = upstreamTables;
    patch._wire_autofill_at = new Date().toISOString();
    patch._wired_from = incoming.some((e) => nodes.find((n) => n.id === e.source)?.type === "destNode")
      ? "destination"
      : "source";
    patch._preview_nonce = Date.now();
    changed = true;
  } else {
    for (const key of ["table", "input_table", "left_table", "right_table"]) {
      maybeRemapField(key);
    }
    if (changed) {
      patch._preview_nonce = Date.now();
    }
  }
  if ((!String(patch.left_table ?? "").trim() || wasAutofill) && upstreamTables.length >= 1) {
    patch.left_table = upstreamTables[0];
    changed = true;
  }
  if ((!String(patch.right_table ?? "").trim() || wasAutofill) && upstreamTables.length >= 2) {
    patch.right_table = upstreamTables[1];
    changed = true;
  }

  if (!changed) return null;
  return { nodeId: targetNodeId, configPatch: patch };
}

/** Fill empty (or prior autofill) input tables on all wired component nodes. */
export function rewireAllComponentInputs(
  nodes: Node[],
  edges: Edge[],
  ctx?: WireInputContext
): Node[] {
  const normalizedEdges = preferDestinationWireEdges(nodes, edges);
  return nodes.map((node) => {
    if (node.type !== "componentNode") return node;
    const wired = wireInputFromUpstreamEdge(nodes, normalizedEdges, node.id, ctx);
    if (!wired) return node;
    return {
      ...node,
      data: {
        ...node.data,
        config: wired.configPatch,
      },
    };
  });
}

/** Edge source when auto-connecting a new node — use the pipeline tail (usually Output). */
export function resolveCanvasAutoWireSourceId(
  _nodes: Node[],
  _edges: Edge[],
  wireFrom: Node,
  _append: { type?: string; data?: Record<string, unknown> }
): string {
  return wireFrom.id;
}
