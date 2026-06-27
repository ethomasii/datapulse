/**
 * Propagate upstream warehouse table refs when wiring canvas edges (Alteryx auto-input).
 */
import type { Edge, Node } from "@xyflow/react";
import { previewTableFromConfig } from "@/lib/elt/pipeline-asset-keys";

export type WireInputContext = {
  /** Raw landing tables from pipeline source config (github issues, etc.). */
  rawLandingTables?: string[];
};

/** Walk through Output nodes to the real data producer (Source or transform). */
export function expandUpstreamSources(nodes: Node[], edges: Edge[], nodeId: string): Node[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return [];

  if (node.type === "destNode") {
    const incoming = edges.filter((e) => e.target === nodeId);
    if (!incoming.length) {
      return nodes.filter((n) => n.type === "sourceNode");
    }
    return incoming.flatMap((e) => expandUpstreamSources(nodes, edges, e.source));
  }

  return [node];
}

function outputTableFromNode(node: Node, ctx?: WireInputContext): string | null {
  if (node.type === "sourceNode") {
    const first = ctx?.rawLandingTables?.[0]?.trim();
    return first || null;
  }
  if (node.type === "transformNode") return null;
  if (node.type === "componentNode") {
    const cfg = (node.data as { config?: Record<string, unknown> })?.config ?? {};
    return previewTableFromConfig(cfg);
  }
  return null;
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
    for (const src of expandUpstreamSources(nodes, edges, edge.source)) {
      const out = outputTableFromNode(src, ctx);
      if (out && !tables.includes(out)) tables.push(out);
    }
  }
  return tables;
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

  const existing = ((target.data as { config?: Record<string, unknown> })?.config ?? {}) as Record<
    string,
    unknown
  >;
  const primary = upstreamTables[0]!;
  const patch: Record<string, unknown> = { ...existing };

  const tableEmpty = !String(patch.table ?? "").trim();
  const wasAutofill = Boolean(patch._wire_autofill_at);
  let changed = false;

  if (tableEmpty || wasAutofill) {
    patch.table = primary;
    patch.input_table = primary;
    patch.input_asset_keys = upstreamTables;
    patch._wire_autofill_at = new Date().toISOString();
    patch._preview_nonce = Date.now();
    changed = true;
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
  return nodes.map((node) => {
    if (node.type !== "componentNode") return node;
    const wired = wireInputFromUpstreamEdge(nodes, edges, node.id, ctx);
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

/** When auto-connecting a transform, never wire from Output — use upstream data steps instead. */
export function resolveCanvasAutoWireSourceId(
  nodes: Node[],
  edges: Edge[],
  wireFrom: Node,
  append: { type?: string; data?: Record<string, unknown> }
): string {
  const isTransformComponent =
    append.type === "componentNode" && String(append.data?.category ?? "transformation") !== "check";
  if (!isTransformComponent || wireFrom.type !== "destNode") return wireFrom.id;

  const expanded = expandUpstreamSources(nodes, edges, wireFrom.id);
  const dataUpstream = expanded.find((n) => n.type === "componentNode" || n.type === "sourceNode");
  return dataUpstream?.id ?? wireFrom.id;
}
