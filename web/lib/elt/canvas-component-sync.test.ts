import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import {
  extractComponentsFromCanvas,
  isValidPipelineCanvasEdge,
  SENSOR_COMPONENT_TO_MONITOR_TYPE,
} from "@/lib/elt/canvas-component-sync";
import { applyDestinationCodegenHints } from "@/lib/elt/destination-codegen-hints";

describe("canvas-component-sync", () => {
  it("extracts quality component into spec", () => {
    const nodes: Node[] = [
      {
        id: "c1",
        type: "componentNode",
        position: { x: 0, y: 0 },
        data: {
          componentId: "dq_check",
          label: "dq_check",
          compileTarget: "quality",
          config: { table: "orders", not_null: ["id"] },
        },
      },
    ];
    const { components, quality, sensorMonitors } = extractComponentsFromCanvas(nodes, []);
    expect(components).toHaveLength(1);
    expect(components[0].type).toBe("quality");
    expect(quality[0]?.table).toBe("orders");
    expect(sensorMonitors).toHaveLength(0);
  });

  it("extracts s3 monitor as sensor", () => {
    const nodes: Node[] = [
      {
        id: "m1",
        type: "componentNode",
        position: { x: 0, y: 0 },
        data: { componentId: "s3_monitor", label: "S3 monitor", compileTarget: "monitor", config: {} },
      },
    ];
    const { sensorMonitors } = extractComponentsFromCanvas(nodes, []);
    expect(sensorMonitors[0]?.monitorType).toBe(SENSOR_COMPONENT_TO_MONITOR_TYPE.s3_monitor);
  });

  it("allows source to component edge", () => {
    const source: Node = { id: "s", type: "sourceNode", position: { x: 0, y: 0 }, data: {} };
    const comp: Node = {
      id: "c",
      type: "componentNode",
      position: { x: 0, y: 0 },
      data: { componentId: "s3_to_database_asset", category: "ingestion" },
    };
    expect(isValidPipelineCanvasEdge(source, comp)).toBe(true);
  });

  it("maps iceberg destination for codegen", () => {
    const r = applyDestinationCodegenHints("iceberg", { warehouse: "s3://lake/wh/" });
    expect(r.destinationType).toBe("s3");
    expect(r.config.table_format).toBe("iceberg");
  });
});
