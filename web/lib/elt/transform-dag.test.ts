import { describe, expect, it } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { deriveTransformDag } from "@/lib/elt/transform-dag";
import { groupAggregateComponent } from "@/lib/elt/native-components/definitions/table-ops";

describe("transform-dag", () => {
  it("orders components by after dependencies", () => {
    const specs = [
      {
        id: "join_step",
        type: "python" as const,
        config: {
          template_id: "join_tables",
          left_table: "a",
          right_table: "b",
          output_table: "staging.joined",
        },
        after: [],
      },
      {
        id: "filter_step",
        type: "python" as const,
        config: {
          template_id: "filter_rows",
          table: "staging.joined",
          condition: "active == True",
          output_table: "staging.active",
        },
        after: ["join_step"],
      },
    ];
    const dag = deriveTransformDag([], [], specs);
    expect(dag.nodes.map((n) => n.specId)).toEqual(["join_step", "filter_step"]);
    expect(dag.edges).toHaveLength(1);
    expect(dag.edges[0]?.source).toBe("join_step");
    expect(dag.nodes[1]?.inputAssets).toContain("staging.joined");
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
    const dag = deriveTransformDag(nodes, [], null);
    expect(dag.nodes).toHaveLength(1);
    expect(dag.nodes[0]?.componentId).toBe("filter_rows");
    expect(dag.nodes[0]?.outputAsset).toBe("staging.out");
  });
});

describe("table-ops components", () => {
  it("group_aggregate emits groupby python", () => {
    const out = groupAggregateComponent.compile({
      table: "staging.orders",
      group_by: ["status"],
      aggregations: '{"amount":"sum"}',
      output_table: "staging.by_status",
    });
    expect(out.python?.join("\n")).toContain("groupby");
    expect(out.python?.join("\n")).toContain("staging.by_status");
  });
});
