/**
 * Place new canvas nodes after the current pipeline tail (not on top of dest).
 */
import type { Edge, Node } from "@xyflow/react";
import { isValidPipelineCanvasEdge } from "@/lib/elt/canvas-component-sync";

const NODE_WIDTH_EST = 220;
const HORIZONTAL_GAP = 48;
const DEFAULT_Y = 120;

export type CanvasAppendTarget = {
  position: { x: number; y: number };
  /** Node to wire as edge source when auto-connecting the new node. */
  upstreamId: string | null;
};

function nodeById(nodes: Node[]): Map<string, Node> {
  return new Map(nodes.map((n) => [n.id, n]));
}

function outgoingTargets(edges: Edge[], sourceId: string): string[] {
  return edges.filter((e) => e.source === sourceId).map((e) => e.target);
}

function appendRowY(nodes: Node[], upstream: Node): number {
  const dest = nodes.find((n) => n.type === "destNode");
  if (dest) return dest.position.y;
  const source = nodes.find((n) => n.type === "sourceNode");
  if (source) return source.position.y;
  return upstream.position.y;
}

/** Rightmost leaf reachable from pipeline roots (source or warehouse). */
export function findCanvasAppendTarget(
  nodes: Node[],
  edges: Edge[],
  options?: { transformOnly?: boolean }
): CanvasAppendTarget {
  if (nodes.length === 0) {
    return { position: { x: 40, y: DEFAULT_Y }, upstreamId: null };
  }

  const byId = nodeById(nodes);
  const roots = options?.transformOnly
    ? nodes.filter((n) => n.type === "destNode")
    : nodes.filter((n) => n.type === "sourceNode");

  const startIds =
    roots.length > 0
      ? roots.map((r) => r.id)
      : nodes.filter((n) => n.type === "destNode").map((n) => n.id);

  if (startIds.length === 0) {
    const rightmost = [...nodes].sort((a, b) => b.position.x - a.position.x)[0]!;
    return {
      position: {
        x: rightmost.position.x + NODE_WIDTH_EST + HORIZONTAL_GAP,
        y: appendRowY(nodes, rightmost),
      },
      upstreamId: rightmost.id,
    };
  }

  const visited = new Set<string>();
  const queue = [...startIds];
  for (const id of queue) visited.add(id);

  let tail: Node | null = null;

  while (queue.length) {
    const id = queue.shift()!;
    const node = byId.get(id);
    if (!node) continue;

    const outs = outgoingTargets(edges, id)
      .map((tid) => byId.get(tid))
      .filter((n): n is Node => !!n);

    if (outs.length === 0) {
      if (!tail || node.position.x >= tail.position.x) tail = node;
    } else {
      for (const child of outs) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          queue.push(child.id);
        }
      }
      // Prefer deepest node on the main horizontal chain (single child to the right).
      if (outs.length === 1) {
        const only = outs[0]!;
        if (only.position.x >= node.position.x && isValidPipelineCanvasEdge(node, only)) {
          if (!tail || only.position.x >= tail.position.x) tail = only;
        }
      }
    }
  }

  if (!tail) {
    tail = startIds.map((id) => byId.get(id)).find(Boolean) ?? nodes[0]!;
  }

  // Walk one more step along a linear component/transform chain to the true end.
  let cursor = tail;
  for (;;) {
    const next = outgoingTargets(edges, cursor.id)
      .map((tid) => byId.get(tid))
      .filter((n): n is Node => !!n && (n.type === "componentNode" || n.type === "transformNode"))
      .sort((a, b) => b.position.x - a.position.x)[0];
    if (!next || !isValidPipelineCanvasEdge(cursor, next)) break;
    cursor = next;
  }
  tail = cursor;

  return {
    position: {
      x: tail.position.x + NODE_WIDTH_EST + HORIZONTAL_GAP,
      y: appendRowY(nodes, tail),
    },
    upstreamId: tail.id,
  };
}
