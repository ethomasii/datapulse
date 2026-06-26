/**
 * Place new canvas nodes after the current pipeline tail (not on top of dest).
 * Positions use estimated box size so connection handles line up horizontally.
 */
import type { Edge, Node } from "@xyflow/react";
import { isValidPipelineCanvasEdge } from "@/lib/elt/canvas-component-sync";

/** Space between upstream right edge and next node left edge. */
export const CANVAS_HORIZONTAL_GAP = 88;
const HORIZONTAL_GAP = CANVAS_HORIZONTAL_GAP;
const DEFAULT_Y = 120;

export type CanvasAppendTarget = {
  position: { x: number; y: number };
  /** Node to wire as edge source when auto-connecting the new node. */
  upstreamId: string | null;
};

export type CanvasAppendNodeSpec = {
  type: Node["type"];
  data?: Record<string, unknown>;
};

type NodeLayoutSpec = { width: number; height: number };

/** Estimated rendered size — matches pipeline-canvas custom node CSS. */
export function estimateNodeLayout(node: Pick<Node, "type" | "data">): NodeLayoutSpec {
  const type = String(node.type ?? "componentNode");
  if (type === "sourceNode" || type === "destNode") {
    return { width: 200, height: 152 };
  }
  if (type === "transformNode") {
    return { width: 220, height: 168 };
  }
  const data = (node.data ?? {}) as Record<string, unknown>;
  const hint = String(data.compileHint ?? "").trim();
  if (!hint) return { width: 196, height: 76 };
  if (hint.length < 72) return { width: 196, height: 96 };
  return { width: 196, height: 118 };
}

function nodeById(nodes: Node[]): Map<string, Node> {
  return new Map(nodes.map((n) => [n.id, n]));
}

function outgoingTargets(edges: Edge[], sourceId: string): string[] {
  return edges.filter((e) => e.source === sourceId).map((e) => e.target);
}

/** Vertical center of the main source → destination backbone row. */
export function chainCenterY(nodes: Node[]): number {
  const dest = nodes.find((n) => n.type === "destNode");
  const ref = dest ?? nodes.find((n) => n.type === "sourceNode");
  if (!ref) return DEFAULT_Y + 76;
  const layout = estimateNodeLayout(ref);
  return ref.position.y + layout.height / 2;
}

export function positionAfterUpstream(
  nodes: Node[],
  upstream: Node,
  append: CanvasAppendNodeSpec
): { x: number; y: number } {
  const up = estimateNodeLayout(upstream);
  const next = estimateNodeLayout({ type: append.type, data: append.data ?? {} });
  const centerY = chainCenterY(nodes);
  return {
    x: upstream.position.x + up.width + HORIZONTAL_GAP,
    y: centerY - next.height / 2,
  };
}

/** Rightmost leaf reachable from pipeline roots (source or warehouse). */
export function findCanvasAppendTarget(
  nodes: Node[],
  edges: Edge[],
  options?: { transformOnly?: boolean; append?: CanvasAppendNodeSpec }
): CanvasAppendTarget {
  const append: CanvasAppendNodeSpec = options?.append ?? {
    type: "componentNode",
    data: {},
  };

  if (nodes.length === 0) {
    const layout = estimateNodeLayout({ type: append.type, data: append.data ?? {} });
    return {
      position: { x: 40, y: chainCenterY([]) - layout.height / 2 },
      upstreamId: null,
    };
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
      position: positionAfterUpstream(nodes, rightmost, append),
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
    position: positionAfterUpstream(nodes, tail, append),
    upstreamId: tail.id,
  };
}
