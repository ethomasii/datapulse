import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { deriveDltDbtFromCanvasNodes, enrichTransformNodesFromDltDbt, syncDltDbtWithCanvas } from "./dbt-canvas";

const transformDbt = (data: Record<string, unknown>): Node =>
  ({
    id: "t1",
    type: "transformNode",
    position: { x: 0, y: 0 },
    data,
  }) as Node;

describe("deriveDltDbtFromCanvasNodes", () => {
  it("returns undefined when no dbt transform", () => {
    expect(deriveDltDbtFromCanvasNodes([])).toBeUndefined();
    expect(
      deriveDltDbtFromCanvasNodes([
        { id: "s", type: "sourceNode", position: { x: 0, y: 0 }, data: {} },
      ])
    ).toBeUndefined();
  });

  it("returns enabled false when dbt but empty path", () => {
    const nodes = [transformDbt({ transformTool: "dbt", dbtPackagePath: "" })];
    expect(deriveDltDbtFromCanvasNodes(nodes)).toEqual({ enabled: false });
  });

  it("derives package path and selection", () => {
    const nodes = [
      transformDbt({
        transformTool: "dbt",
        dbtPackagePath: "/repo/dbt",
        dbtDatasetName: "analytics_marts",
        dbtRepositoryBranch: "main",
        dbtRunScope: "selection",
        dbtSelector: "tag:nightly",
      }),
    ];
    expect(deriveDltDbtFromCanvasNodes(nodes)).toEqual({
      enabled: true,
      package_path: "/repo/dbt",
      dataset_name: "analytics_marts",
      package_repository_branch: "main",
      run_scope: "selection",
      selector: "tag:nightly",
    });
  });

  it("derives slice var name overrides", () => {
    const nodes = [
      transformDbt({
        transformTool: "dbt",
        dbtPackagePath: "/dbt",
        dbtSliceValueVar: "ds",
        dbtSliceColumnVar: "slice_col",
      }),
    ];
    expect(deriveDltDbtFromCanvasNodes(nodes)).toMatchObject({
      slice_value_var: "ds",
      slice_column_var: "slice_col",
    });
  });
});

describe("syncDltDbtWithCanvas", () => {
  it("writes dlt_dbt when canvas has dbt transform", () => {
    const base: Record<string, unknown> = {
      canvas: {
        v: 1,
        nodes: [transformDbt({ transformTool: "dbt", dbtPackagePath: "https://github.com/o/p.git" })],
        edges: [],
      },
    };
    syncDltDbtWithCanvas(base);
    expect(base.dlt_dbt).toMatchObject({
      enabled: true,
      package_path: "https://github.com/o/p.git",
      run_scope: "all",
    });
  });

  it("does not touch dlt_dbt when canvas has no transform nodes", () => {
    const base: Record<string, unknown> = {
      dlt_dbt: { enabled: true, package_path: "/keep" },
      canvas: {
        v: 1,
        nodes: [{ id: "s", type: "sourceNode", position: { x: 0, y: 0 }, data: {} } as Node],
        edges: [],
      },
    };
    syncDltDbtWithCanvas(base);
    expect(base.dlt_dbt).toEqual({ enabled: true, package_path: "/keep" });
  });

  it("removes dlt_dbt when transform is not dbt", () => {
    const base: Record<string, unknown> = {
      dlt_dbt: { enabled: true, package_path: "/x" },
      canvas: {
        v: 1,
        nodes: [
          {
            id: "t1",
            type: "transformNode",
            position: { x: 0, y: 0 },
            data: { transformTool: "sql", label: "x" },
          } as Node,
        ],
        edges: [],
      },
    };
    syncDltDbtWithCanvas(base);
    expect(base.dlt_dbt).toBeUndefined();
  });
});

describe("enrichTransformNodesFromDltDbt", () => {
  it("fills empty dbt node from persisted config", () => {
    const nodes = [transformDbt({ transformTool: "dbt", label: "x" })];
    const out = enrichTransformNodesFromDltDbt(nodes, {
      enabled: true,
      package_path: "/p",
      run_scope: "selection",
      selector: "m1+",
    });
    expect((out[0].data as { dbtPackagePath?: string }).dbtPackagePath).toBe("/p");
    expect((out[0].data as { dbtRunScope?: string }).dbtRunScope).toBe("selection");
    expect((out[0].data as { dbtSelector?: string }).dbtSelector).toBe("m1+");
  });

  it("hydrates slice var overrides from dlt_dbt", () => {
    const nodes = [transformDbt({ transformTool: "dbt", label: "x" })];
    const out = enrichTransformNodesFromDltDbt(nodes, {
      enabled: true,
      package_path: "/p",
      slice_value_var: "run_date",
      slice_column_var: "col_name",
    });
    const d = out[0].data as { dbtSliceValueVar?: string; dbtSliceColumnVar?: string };
    expect(d.dbtSliceValueVar).toBe("run_date");
    expect(d.dbtSliceColumnVar).toBe("col_name");
  });
});
