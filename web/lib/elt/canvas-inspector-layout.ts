import type { NativeComponentField } from "@/lib/elt/native-components";
import { operatorColumnGridMode } from "@/lib/elt/operator-column-grid-mode";

const COLUMN_GRID_HIDDEN_KEYS = new Set([
  "table",
  "input_table",
  "output_table",
  "columns",
  "column_names",
]);

const TABLE_IO_HIDDEN_KEYS = new Set(["table", "input_table", "output_table"]);

export type CanvasInspectorLayout = {
  columnGridMode: ReturnType<typeof operatorColumnGridMode>;
  hideCatalogPanel: boolean;
  showStepIoPanel: boolean;
  showOutputTable: boolean;
  hiddenFormKeys: Set<string>;
  visibleFormFields: NativeComponentField[];
};

/** Decide which config sections to show in the canvas operator inspector. */
export function resolveCanvasInspectorLayout(
  componentId: string,
  formFields: NativeComponentField[]
): CanvasInspectorLayout {
  const columnGridMode = operatorColumnGridMode(componentId);
  const keys = new Set(formFields.map((f) => f.key));
  const isJoinLike = keys.has("left_table") || keys.has("right_table");
  const hasTableField = keys.has("table") && !isJoinLike;
  const showOutputTable = keys.has("output_table");
  const showStepIoPanel = Boolean(columnGridMode || hasTableField);
  const hideCatalogPanel = showStepIoPanel;

  const hiddenFormKeys = new Set<string>();
  if (columnGridMode) {
    COLUMN_GRID_HIDDEN_KEYS.forEach((k) => hiddenFormKeys.add(k));
  } else if (hasTableField) {
    TABLE_IO_HIDDEN_KEYS.forEach((k) => hiddenFormKeys.add(k));
  }

  const visibleFormFields = formFields.filter((f) => !hiddenFormKeys.has(f.key));

  return {
    columnGridMode,
    hideCatalogPanel,
    showStepIoPanel,
    showOutputTable,
    hiddenFormKeys,
    visibleFormFields,
  };
}
