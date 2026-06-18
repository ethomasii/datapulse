import type { Edge, Node } from "@xyflow/react";

const EDGE_HIT_PX = 48;

function edgeMidpoint(source: Node, target: Node): { x: number; y: number } {
  return {
    x: (source.position.x + target.position.x) / 2,
    y: (source.position.y + target.position.y) / 2,
  };
}

/** Find canvas edge nearest to a flow position (for drop-on-wire insertion). */
export function findNearestEdge(
  nodes: Node[],
  edges: Edge[],
  point: { x: number; y: number }
): Edge | null {
  let best: { edge: Edge; dist: number } | null = null;
  for (const edge of edges) {
    const s = nodes.find((n) => n.id === edge.source);
    const t = nodes.find((n) => n.id === edge.target);
    if (!s || !t) continue;
    const mid = edgeMidpoint(s, t);
    const dist = Math.hypot(point.x - mid.x, point.y - mid.y);
    if (dist <= EDGE_HIT_PX && (!best || dist < best.dist)) {
      best = { edge, dist };
    }
  }
  return best?.edge ?? null;
}

/** Insert a new node onto an edge, splitting source → target into source → node → target. */
export function insertNodeOnEdge(
  nodes: Node[],
  edges: Edge[],
  edge: Edge,
  newNode: Node
): { nodes: Node[]; edges: Edge[] } {
  const mid = (() => {
    const s = nodes.find((n) => n.id === edge.source);
    const t = nodes.find((n) => n.id === edge.target);
    if (s && t) return edgeMidpoint(s, t);
    return newNode.position;
  })();

  const placed: Node = { ...newNode, position: mid };
  const nextNodes = [...nodes, placed];
  const nextEdges = [
    ...edges.filter((e) => e.id !== edge.id),
    {
      id: `e-${edge.source}-${placed.id}`,
      source: edge.source,
      target: placed.id,
      animated: true,
      style: edge.style,
    },
    {
      id: `e-${placed.id}-${edge.target}`,
      source: placed.id,
      target: edge.target,
      animated: true,
      style: edge.style,
    },
  ];
  return { nodes: nextNodes, edges: nextEdges };
}
