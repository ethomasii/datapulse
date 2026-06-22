/** True when a canvas patch only adds nodes — every existing node id is preserved. */
export function isAdditiveCanvasPatch(
  beforeNodes: { id: string }[],
  afterNodes: { id: string }[]
): boolean {
  if (afterNodes.length <= beforeNodes.length) return false;
  const afterIds = new Set(afterNodes.map((n) => n.id));
  return beforeNodes.every((n) => afterIds.has(n.id));
}
