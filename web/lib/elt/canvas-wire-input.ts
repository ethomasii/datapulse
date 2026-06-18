/**
 * Propagate upstream warehouse table refs when wiring canvas edges (Alteryx auto-input).
 */
import type { Edge, Node } from "@xyflow/react";
import { previewTableFromConfig } from "@/lib/elt/pipeline-asset-keys";

function outputTableFromNode(node: Node): string | null {
  if (node.type === "sourceNode") return null;
  if (node.type === "destNode") return null;
  if (node.type === "transformNode") return null;
  if (node.type === "componentNode") {
    const cfg = (node.data as { config?: Record<string, unknown> })?.config ?? {};
    return previewTableFromConfig(cfg);
  }
  return null;
}

/** Patch target component config with upstream table ref after a new edge. */
export function wireInputFromUpstreamEdge(
  nodes: Node[],
  edges: Edge[],
  targetNodeId: string
): { nodeId: string; configPatch: Record<string, unknown> } | null {
  const target = nodes.find((n) => n.id === targetNodeId);
  if (!target || target.type !== "componentNode") return null;

  const incoming = edges.filter((e) => e.target === targetNodeId);
  if (!incoming.length) return null;

  const upstreamTables: string[] = [];
  for (const edge of incoming) {
    const src = nodes.find((n) => n.id === edge.source);
    if (!src) continue;
    const out = outputTableFromNode(src);
    if (out) upstreamTables.push(out);
  }
  if (!upstreamTables.length) return null;

  const existing = ((target.data as { config?: Record<string, unknown> })?.config ?? {}) as Record<
    string,
    unknown
  >;
  const primary = upstreamTables[0]!;
  const patch: Record<string, unknown> = { ...existing };

  if (!String(patch.table ?? "").trim()) patch.table = primary;
  if (!String(patch.input_table ?? "").trim()) patch.input_table = primary;
  if (!String(patch.left_table ?? "").trim() && upstreamTables.length >= 1) {
    patch.left_table = upstreamTables[0];
  }
  if (!String(patch.right_table ?? "").trim() && upstreamTables.length >= 2) {
    patch.right_table = upstreamTables[1];
  }
  if (upstreamTables.length) {
    patch.input_asset_keys = upstreamTables;
    patch._wire_autofill_at = new Date().toISOString();
    patch._preview_nonce = Date.now();
  }

  return { nodeId: targetNodeId, configPatch: patch };
}
