import { describe, expect, it } from "vitest";
import { detectStepIoMode, resolveCanvasInspectorLayout } from "@/lib/elt/canvas-inspector-layout";
import {
  filterCanvasOperatorComponents,
  isCanvasOperatorComponent,
} from "@/lib/elt/canvas-operator-scope";

describe("canvas-operator-scope", () => {
  it("excludes quality checks from canvas operators", () => {
    expect(isCanvasOperatorComponent({ id: "great_expectations_check", category: "check" })).toBe(false);
    expect(isCanvasOperatorComponent({ id: "soda_check", category: "check", compileTarget: "quality" })).toBe(
      false
    );
    expect(isCanvasOperatorComponent({ id: "select_columns", category: "transformation" })).toBe(true);
  });

  it("filters check category from mixed lists", () => {
    const items = filterCanvasOperatorComponents([
      { id: "filter_rows", category: "transformation" },
      { id: "dq_check", category: "check", compileTarget: "quality" },
    ]);
    expect(items.map((i) => i.id)).toEqual(["filter_rows"]);
  });
});

describe("detectStepIoMode", () => {
  it("detects join, union, single, and output-only shapes", () => {
    expect(detectStepIoMode(new Set(["left_table", "right_table", "output_table"]))).toBe("join");
    expect(detectStepIoMode(new Set(["tables", "output_table"]))).toBe("union");
    expect(detectStepIoMode(new Set(["table", "output_table"]))).toBe("single");
    expect(detectStepIoMode(new Set(["prompt", "output_table"]))).toBe("output_only");
    expect(detectStepIoMode(new Set(["sql"]))).toBe(null);
  });
});

describe("canvas-inspector-layout", () => {
  it("hides duplicate table/column fields for select_columns", () => {
    const layout = resolveCanvasInspectorLayout("select_columns", [
      { key: "table", label: "Table", type: "string", required: true },
      { key: "columns", label: "Columns", type: "string_list", required: true },
      { key: "output_table", label: "Output table", type: "string" },
      { key: "execution", label: "Execution", type: "select", options: ["warehouse", "dataframe"] },
    ]);
    expect(layout.stepIoMode).toBe("single");
    expect(layout.hideCatalogPanel).toBe(true);
    expect(layout.columnGridMode).toBe("select");
    expect(layout.visibleFormFields.map((f) => f.key)).toEqual(["execution"]);
  });

  it("uses join I/O for join_tables", () => {
    const layout = resolveCanvasInspectorLayout("join_tables", [
      { key: "left_table", label: "Left", type: "string", required: true },
      { key: "right_table", label: "Right", type: "string", required: true },
      { key: "how", label: "Join type", type: "select", options: ["inner"] },
      { key: "on", label: "On", type: "string_list" },
      { key: "output_table", label: "Output", type: "string", required: true },
    ]);
    expect(layout.stepIoMode).toBe("join");
    expect(layout.hideCatalogPanel).toBe(true);
    expect(layout.outputOptional).toBe(false);
    expect(layout.visibleFormFields.map((f) => f.key)).toEqual(["how", "on"]);
  });

  it("hides catalog for AI agent and surfaces prompt fields only", () => {
    const layout = resolveCanvasInspectorLayout("litellm_agent", [
      { key: "prompt", label: "Prompt", type: "text", required: true },
      { key: "model", label: "Model", type: "string" },
      { key: "output_table", label: "Output", type: "string" },
    ]);
    expect(layout.stepIoMode).toBe("output_only");
    expect(layout.hideCatalogPanel).toBe(true);
    expect(layout.visibleFormFields.map((f) => f.key)).toEqual(["prompt", "model"]);
  });

  it("hides catalog for sql-only transforms", () => {
    const layout = resolveCanvasInspectorLayout("sql_transform", [
      { key: "sql", label: "SQL", type: "text", required: true },
    ]);
    expect(layout.stepIoMode).toBe(null);
    expect(layout.hideCatalogPanel).toBe(true);
    expect(layout.visibleFormFields.map((f) => f.key)).toEqual(["sql"]);
  });
});
