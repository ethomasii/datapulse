import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import {
  TERMINAL_ROW_BELOW_GAP,
  chainHandleY,
  estimateNodeLayout,
  findCanvasAppendTarget,
  handleYOffset,
  positionAfterUpstream,
  positionTerminalAfterUpstream,
} from "./canvas-node-placement";

const backbone: Node[] = [
  { id: "s", type: "sourceNode", position: { x: 40, y: 120 }, data: {} },
  { id: "d", type: "destNode", position: { x: 360, y: 120 }, data: {} },
];

const backboneEdges: Edge[] = [{ id: "e1", source: "s", target: "d" }];

describe("estimateNodeLayout", () => {
  it("uses a shorter box when a component has no compile hint", () => {
    expect(estimateNodeLayout({ type: "componentNode", data: {} }).height).toBe(88);
  });
});

describe("findCanvasAppendTarget", () => {
  it("aligns a compact component handle with the destination row", () => {
    const handleLine = chainHandleY(backbone);
    const { position, upstreamId } = findCanvasAppendTarget(backbone, backboneEdges, {
      append: { type: "componentNode", data: { compileHint: "" } },
    });
    expect(upstreamId).toBe("s");
    expect(position.x).toBe(360 + 200 + 88);
    expect(position.y + handleYOffset({ type: "componentNode", data: { compileHint: "" } })).toBeCloseTo(
      handleLine,
      0
    );
  });

  it("chains with spacing from upstream width, not a fixed estimate", () => {
    const compact = { type: "componentNode" as const, data: { compileHint: "" } };
    const first = findCanvasAppendTarget(backbone, backboneEdges, { append: compact });
    const nodes: Node[] = [
      ...backbone,
      {
        id: "c1",
        type: "componentNode",
        position: first.position,
        data: { compileHint: "" },
      },
    ];
    const edges: Edge[] = [...backboneEdges, { id: "e2", source: "d", target: "c1" }];
    const second = findCanvasAppendTarget(nodes, edges, { append: compact });
    const gap = second.position.x - (first.position.x + estimateNodeLayout(nodes[2]!).width);
    expect(gap).toBe(88);
    expect(second.position.y).toBe(first.position.y);
  });

  it("chains hinted components with full width spacing", () => {
    const alterRowHint = "Warehouse SQL or dataframe transform after load";
    const append = { type: "componentNode" as const, data: { compileHint: alterRowHint } };
    const first = findCanvasAppendTarget(backbone, backboneEdges, { append });
    const nodes: Node[] = [
      ...backbone,
      {
        id: "c1",
        type: "componentNode",
        position: first.position,
        data: { compileHint: alterRowHint },
      },
    ];
    const edges: Edge[] = [...backboneEdges, { id: "e2", source: "d", target: "c1" }];
    const second = findCanvasAppendTarget(nodes, edges, { append });
    const gap = second.position.x - (first.position.x + estimateNodeLayout(nodes[2]!).width);
    expect(gap).toBe(88);
    expect(second.position.y).toBe(first.position.y);
  });
});

describe("positionAfterUpstream", () => {
  it("aligns handles between destination and short component", () => {
    const dest = backbone[1]!;
    const pos = positionAfterUpstream(backbone, dest, {
      type: "componentNode",
      data: { compileHint: "" },
    });
    const destHandle = dest.position.y + handleYOffset(dest);
    const nextHandle = pos.y + handleYOffset({ type: "componentNode", data: {} });
    expect(nextHandle).toBeCloseTo(destHandle, 0);
  });

  it("aligns alter_row-style components that ship a category compile hint", () => {
    const dest = backbone[1]!;
    const hint = "Warehouse SQL or dataframe transform after load";
    const pos = positionAfterUpstream(backbone, dest, {
      type: "componentNode",
      data: { compileHint: hint },
    });
    const destHandle = dest.position.y + handleYOffset(dest);
    const nextHandle = pos.y + handleYOffset({ type: "componentNode", data: { compileHint: hint } });
    expect(nextHandle).toBeCloseTo(destHandle, 0);
  });
});

describe("terminal validate placement", () => {
  it("places dq checks below the main transform row", () => {
    const dest = backbone[1]!;
    const append = {
      type: "componentNode" as const,
      data: { category: "check", compileTarget: "quality", canvasPorts: { left: true, right: false } },
    };
    const pos = positionTerminalAfterUpstream(backbone, dest, append);
    const handleLine = chainHandleY(backbone);
    const checkHandle = pos.y + handleYOffset({ type: "componentNode", data: append.data });
    expect(checkHandle).toBeCloseTo(handleLine + TERMINAL_ROW_BELOW_GAP, 0);
    expect(pos.x).toBe(dest.position.x);
  });

  it("appends validate nodes under the tail, not in the transform row", () => {
    const transformAppend = { type: "componentNode" as const, data: { compileHint: "" } };
    const first = findCanvasAppendTarget(backbone, backboneEdges, { append: transformAppend });
    const nodes: Node[] = [
      ...backbone,
      {
        id: "c1",
        type: "componentNode",
        position: first.position,
        data: { compileHint: "" },
      },
    ];
    const edges: Edge[] = [...backboneEdges, { id: "e2", source: "d", target: "c1" }];
    const checkAppend = {
      type: "componentNode" as const,
      data: { category: "check", compileTarget: "quality", canvasPorts: { left: true, right: false } },
    };
    const check = findCanvasAppendTarget(nodes, edges, { append: checkAppend });
    expect(check.upstreamId).toBe("c1");
    const handleLine = chainHandleY(nodes);
    const checkHandle =
      check.position.y + handleYOffset({ type: "componentNode", data: checkAppend.data });
    expect(checkHandle).toBeGreaterThan(handleLine + 40);
  });
});
