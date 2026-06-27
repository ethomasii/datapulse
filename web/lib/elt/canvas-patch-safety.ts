/** True when a canvas patch only adds nodes — every existing node id is preserved. */
export function isAdditiveCanvasPatch(
  beforeNodes: { id: string }[],
  afterNodes: { id: string }[]
): boolean {
  if (afterNodes.length <= beforeNodes.length) return false;
  const afterIds = new Set(afterNodes.map((n) => n.id));
  return beforeNodes.every((n) => afterIds.has(n.id));
}

/** True when node ids are unchanged (replace component, relayout, connect/disconnect). */
export function isInPlaceCanvasPatch(
  beforeNodes: { id: string }[],
  afterNodes: { id: string }[]
): boolean {
  if (afterNodes.length !== beforeNodes.length) return false;
  const afterIds = new Set(afterNodes.map((n) => n.id));
  return beforeNodes.every((n) => afterIds.has(n.id));
}

/** Pulse AI canvas: preview on canvas without server save (append or in-place edit). */
export function isLocalCanvasPreviewPatch(
  beforeNodes: { id: string }[],
  afterNodes: { id: string }[]
): boolean {
  return isAdditiveCanvasPatch(beforeNodes, afterNodes) || isInPlaceCanvasPatch(beforeNodes, afterNodes);
}
