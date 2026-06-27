import { describe, expect, it } from "vitest";
import { resolveCanvasInspectorLayout } from "@/lib/elt/canvas-inspector-layout";
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

describe("canvas-inspector-layout", () => {
  it("hides duplicate table/column fields for select_columns", () => {
    const layout = resolveCanvasInspectorLayout("select_columns", [
      { key: "table", label: "Table", type: "string", required: true },
      { key: "columns", label: "Columns", type: "string_list", required: true },
      { key: "output_table", label: "Output table", type: "string" },
      { key: "execution", label: "Execution", type: "select", options: ["warehouse", "dataframe"] },
    ]);
    expect(layout.showStepIoPanel).toBe(true);
    expect(layout.hideCatalogPanel).toBe(true);
    expect(layout.columnGridMode).toBe("select");
    expect(layout.visibleFormFields.map((f) => f.key)).toEqual(["execution"]);
  });
});
