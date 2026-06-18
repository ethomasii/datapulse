import { describe, expect, it } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { deriveTransformDag } from "@/lib/elt/transform-dag";

describe("transform-dag", () => {
  it("orders components by after dependencies", () => {
    const specs = [
      {
        id: "join_step",
        type: "python" as const,
        assetKey: "staging.joined",
        config: {
          template_id: "join_tables",
          left_table: "a",
          right_table: "b",
          output_table: "staging.joined",
        },
      },
      {
        id: "filter_step",
        type: "python" as const,
        assetKey: "staging.active",
        config: {
          template_id: "filter_rows",
          table: "staging.joined",
          condition: "active == True",
          output_table: "staging.active",
        },
        after: ["join_step"],
      },
    ];
    const dag = deriveTransformDag([], [], specs, { pipelineName: "demo" });
    const steps = dag.nodes.filter((n) => n.kind === "component");
    expect(steps.map((n) => n.specId)).toEqual(["join_step", "filter_step"]);
    expect(dag.edges.some((e) => e.source === "join_step" && e.target === "filter_step")).toBe(true);
  });

  it("includes transform nodes in unified DAG", () => {
    const nodes: Node[] = [
      { id: "d1", type: "destNode", position: { x: 0, y: 0 }, data: {} },
      {
        id: "t1",
        type: "transformNode",
        position: { x: 100, y: 0 },
        data: { transformTool: "dbt", dbtPackagePath: "./dbt" },
      },
    ];
    const dag = deriveTransformDag(nodes, [], null, { pipelineName: "demo" });
    expect(dag.nodes.some((n) => n.kind === "transform")).toBe(true);
    expect(dag.nodes.some((n) => n.kind === "extract")).toBe(true);
    expect(dag.nodes.some((n) => n.kind === "load")).toBe(true);
  });

  it("derives from canvas component nodes", () => {
    const nodes: Node[] = [
      {
        id: "c1",
        type: "componentNode",
        position: { x: 0, y: 0 },
        data: {
          componentId: "filter_rows",
          label: "filter",
          category: "transformation",
          config: { table: "t", condition: "x > 0", output_table: "staging.out" },
        },
      },
    ];
    const dag = deriveTransformDag(nodes, [], null, { pipelineName: "demo" });
    const step = dag.nodes.find((n) => n.kind === "component");
    expect(step?.componentId).toBe("filter_rows");
    expect(step?.assetKey).toBe("staging.out");
  });
});
