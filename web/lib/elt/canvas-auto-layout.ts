/**
 * Auto-layout pipeline canvas nodes left-to-right with center-aligned handles.
 * Positions are written to each node's `position` — persist via Save to pipeline.
 */
import type { Edge, Node } from "@xyflow/react";
import {
  CANVAS_HORIZONTAL_GAP,
  TERMINAL_ROW_BELOW_GAP,
  chainHandleY,
  estimateNodeLayout,
  handleYOffset,
} from "@/lib/elt/canvas-node-placement";
import { isTerminalComponentNode } from "@/lib/elt/component-canvas-io";

const START_X = 40;
const PARALLEL_Y = 48;
const PARALLEL_X_STAGGER = 240;
const STACK_GAP = 20;

function isParallelBranchNode(
  node: Node,
  incoming: Map<string, string[]>,
  nodesById: Map<string, Node>
): boolean {
  if (node.type !== "componentNode") return false;
  const preds = incoming.get(node.id) ?? [];
  if (preds.length !== 1) return false;
  const parent = nodesById.get(preds[0]!);
  if (parent?.type !== "sourceNode") return false;
  const d = node.data as Record<string, unknown>;
  const cat = String(d.category ?? "");
  const target = String(d.compileTarget ?? "");
  return cat === "sensor" || cat === "observation" || target === "monitor";
}

function assignColumns(nodes: Node[], edges: Edge[]): Map<string, number> {
  const column = new Map<string, number>();
  const sourceIds = nodes.filter((n) => n.type === "sourceNode").map((n) => n.id);
  const rootIds =
    sourceIds.length > 0
      ? sourceIds
      : nodes.filter((n) => n.type === "destNode").map((n) => n.id);

  const queue = [...rootIds];
  for (const id of rootIds) column.set(id, 0);

  while (queue.length) {
    const u = queue.shift()!;
    const col = column.get(u) ?? 0;
    for (const e of edges) {
      if (e.source !== u) continue;
      const next = col + 1;
      if ((column.get(e.target) ?? -1) < next) {
        column.set(e.target, next);
        queue.push(e.target);
      }
    }
  }

  for (const n of nodes) {
    if (!column.has(n.id)) column.set(n.id, 0);
  }
  return column;
}

/** Re-space nodes on the canvas graph (does not mutate edges). */
export function autoLayoutPipelineCanvas(nodes: Node[], edges: Edge[]): Node[] {
  if (!nodes.length) return nodes;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, string[]>();
  for (const n of nodes) incoming.set(n.id, []);
  for (const e of edges) incoming.get(e.target)?.push(e.source);

  const column = assignColumns(nodes, edges);
  const handleLine = chainHandleY(nodes);

  const byColumn = new Map<number, Node[]>();
  for (const n of nodes) {
    const col = column.get(n.id) ?? 0;
    if (!byColumn.has(col)) byColumn.set(col, []);
    byColumn.get(col)!.push(n);
  }

  const positionById = new Map<string, { x: number; y: number }>();
  let parallelBranchIndex = 0;
  let cursorX = START_X;

  const sortedCols = Array.from(byColumn.keys()).sort((a, b) => a - b);

  for (const col of sortedCols) {
    const colNodes = (byColumn.get(col) ?? []).filter(
      (n) => !isParallelBranchNode(n, incoming, nodesById)
    );
    if (colNodes.length === 0) continue;

    const maxWidth = Math.max(...colNodes.map((n) => estimateNodeLayout(n).width));

    if (colNodes.length === 1) {
      const n = colNodes[0]!;
      positionById.set(n.id, { x: cursorX, y: handleLine - handleYOffset(n) });
    } else {
      const totalHeight =
        colNodes.reduce((sum, n) => sum + estimateNodeLayout(n).height, 0) +
        STACK_GAP * Math.max(0, colNodes.length - 1);
      let stackY = handleLine - totalHeight / 2;

      for (const n of colNodes) {
        const layout = estimateNodeLayout(n);
        positionById.set(n.id, { x: cursorX, y: stackY });
        stackY += layout.height + STACK_GAP;
      }
    }

    cursorX += maxWidth + CANVAS_HORIZONTAL_GAP;
  }

  for (const n of nodes) {
    if (!isParallelBranchNode(n, incoming, nodesById)) continue;
    positionById.set(n.id, {
      x: START_X + parallelBranchIndex * PARALLEL_X_STAGGER,
      y: PARALLEL_Y,
    });
    parallelBranchIndex += 1;
  }

  for (const n of nodes) {
    if (!isTerminalComponentNode(n)) continue;
    const preds = incoming.get(n.id) ?? [];
    const parentId = preds[0];
    const parentPos = parentId ? positionById.get(parentId) : undefined;
    if (!parentPos) continue;
    positionById.set(n.id, {
      x: parentPos.x,
      y: handleLine + TERMINAL_ROW_BELOW_GAP - handleYOffset(n),
    });
  }

  return nodes.map((n) => ({
    ...n,
    position: positionById.get(n.id) ?? n.position,
  }));
}
