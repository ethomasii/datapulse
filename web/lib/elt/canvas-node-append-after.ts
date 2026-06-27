/**
 * Append or insert a canvas node immediately after a chosen upstream step.
 */

import type { Edge, Node } from "@xyflow/react";
import { isValidPipelineCanvasEdge } from "@/lib/elt/canvas-component-sync";
import { isTerminalComponentNode } from "@/lib/elt/component-canvas-io";
import { insertNodeOnEdge } from "@/lib/elt/canvas-edge-insert";
import { positionForAppend, type CanvasAppendNodeSpec } from "@/lib/elt/canvas-node-placement";

export function findAppendTargetAfterNode(
  nodes: Node[],
  edges: Edge[],
  upstreamId: string,
  append: CanvasAppendNodeSpec
): { position: { x: number; y: number }; upstreamId: string } | null {
  const upstream = nodes.find((n) => n.id === upstreamId);
  if (!upstream) return null;
  if (isTerminalComponentNode(upstream)) return null;
  return {
    position: positionForAppend(nodes, upstream, append),
    upstreamId: upstream.id,
  };
}

/** Insert after upstream — splits a single downstream edge when possible. */
export function appendNodeAfterUpstream(
  nodes: Node[],
  edges: Edge[],
  upstreamId: string,
  newNode: Node,
  opts?: { sourceHandle?: string }
): { nodes: Node[]; edges: Edge[]; inserted: boolean } {
  const upstream = nodes.find((n) => n.id === upstreamId);
  if (!upstream) return { nodes, edges, inserted: false };

  const outs = edges.filter((e) => e.source === upstreamId);
  if (outs.length === 1) {
    const edge = outs[0]!;
    const tgt = nodes.find((n) => n.id === edge.target);
    if (
      tgt &&
      isValidPipelineCanvasEdge(upstream, newNode) &&
      isValidPipelineCanvasEdge(newNode, tgt)
    ) {
      const result = insertNodeOnEdge(nodes, edges, edge, newNode, opts);
      return { ...result, inserted: true };
    }
  }

  if (!isValidPipelineCanvasEdge(upstream, newNode)) {
    return { nodes: [...nodes, newNode], edges, inserted: true };
  }

  const nextEdges = [
    ...edges,
    {
      id: `e-${upstreamId}-${newNode.id}${opts?.sourceHandle ? `-${opts.sourceHandle}` : ""}`,
      source: upstreamId,
      target: newNode.id,
      sourceHandle: opts?.sourceHandle,
      animated: true,
    },
  ];
  return { nodes: [...nodes, newNode], edges: nextEdges, inserted: true };
}

export function canAddStepAfterNode(node: Node): boolean {
  if (node.type === "sourceNode" || node.type === "destNode" || node.type === "transformNode") {
    return true;
  }
  if (node.type === "componentNode") {
    return !isTerminalComponentNode(node);
  }
  return false;
}
