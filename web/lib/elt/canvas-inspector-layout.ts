import type { NativeComponentField } from "@/lib/elt/native-components";
import { operatorColumnGridMode } from "@/lib/elt/operator-column-grid-mode";

/** How table I/O fields are surfaced in the canvas inspector. */
export type StepIoMode = "single" | "join" | "union" | "output_only" | "router";

const COLUMN_GRID_HIDDEN_KEYS = new Set([
  "table",
  "input_table",
  "output_table",
  "columns",
  "column_names",
]);

const SINGLE_IO_HIDDEN_KEYS = new Set(["table", "input_table", "output_table"]);

const JOIN_IO_HIDDEN_KEYS = new Set([
  "left_table",
  "right_table",
  "left_asset_key",
  "right_asset_key",
  "output_table",
  "input_table",
]);

const UNION_IO_HIDDEN_KEYS = new Set(["tables", "input_tables", "output_table"]);

const OUTPUT_ONLY_HIDDEN_KEYS = new Set(["output_table", "asset_name", "asset_key"]);

const ROUTER_IO_HIDDEN_KEYS = new Set([
  "table",
  "input_table",
  "output_table",
  "routes",
  "default_output_table",
]);

const CATALOG_DUPLICATE_KEYS = new Set([
  "input_asset_keys",
  "output_asset_key",
  "upstream_asset_key",
]);

export type CanvasInspectorLayout = {
  columnGridMode: ReturnType<typeof operatorColumnGridMode>;
  stepIoMode: StepIoMode | null;
  hideCatalogPanel: boolean;
  outputOptional: boolean;
  hiddenFormKeys: Set<string>;
  visibleFormFields: NativeComponentField[];
};

function fieldKeys(formFields: NativeComponentField[]): Set<string> {
  return new Set(formFields.map((f) => f.key));
}

function isOutputOptional(formFields: NativeComponentField[], keys: Set<string>): boolean {
  if (!keys.has("output_table")) return true;
  const field = formFields.find((f) => f.key === "output_table");
  return field ? !field.required : true;
}

/** Infer table I/O panel mode from native / package field definitions. */
export function detectStepIoMode(keys: Set<string>, componentId?: string): StepIoMode | null {
  const id = componentId?.trim() ?? "";
  if (
    id === "router" ||
    id === "conditional_split" ||
    id === "branch" ||
    keys.has("routes")
  ) {
    return "router";
  }
  if (keys.has("left_table") || keys.has("right_table")) return "join";
  if (keys.has("tables") && !keys.has("table")) return "union";
  if (keys.has("table")) return "single";
  if (keys.has("output_table")) return "output_only";
  return null;
}

function hiddenKeysForStepIo(
  stepIoMode: StepIoMode | null,
  columnGridMode: ReturnType<typeof operatorColumnGridMode>
): Set<string> {
  const hidden = new Set(CATALOG_DUPLICATE_KEYS);
  if (!stepIoMode) return hidden;

  if (stepIoMode === "join") {
    JOIN_IO_HIDDEN_KEYS.forEach((k) => hidden.add(k));
  } else if (stepIoMode === "union") {
    UNION_IO_HIDDEN_KEYS.forEach((k) => hidden.add(k));
  } else if (stepIoMode === "router") {
    ROUTER_IO_HIDDEN_KEYS.forEach((k) => hidden.add(k));
  } else if (stepIoMode === "output_only") {
    OUTPUT_ONLY_HIDDEN_KEYS.forEach((k) => hidden.add(k));
  } else if (columnGridMode) {
    COLUMN_GRID_HIDDEN_KEYS.forEach((k) => hidden.add(k));
  } else {
    SINGLE_IO_HIDDEN_KEYS.forEach((k) => hidden.add(k));
  }
  return hidden;
}

/** Decide which config sections to show in the canvas operator inspector. */
export function resolveCanvasInspectorLayout(
  componentId: string,
  formFields: NativeComponentField[]
): CanvasInspectorLayout {
  const columnGridMode = operatorColumnGridMode(componentId);
  const keys = fieldKeys(formFields);
  const stepIoMode = detectStepIoMode(keys, componentId);
  const hiddenFormKeys = hiddenKeysForStepIo(stepIoMode, columnGridMode);
  const visibleFormFields = formFields.filter((f) => !hiddenFormKeys.has(f.key));

  return {
    columnGridMode,
    stepIoMode,
    hideCatalogPanel: formFields.length > 0,
    outputOptional:
      stepIoMode === "single" || stepIoMode === "output_only"
        ? isOutputOptional(formFields, keys)
        : false,
    hiddenFormKeys,
    visibleFormFields,
  };
}
