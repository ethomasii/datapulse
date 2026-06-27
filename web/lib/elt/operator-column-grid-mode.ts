/** Components that use the checkbox column picker in the canvas inspector. */
export function operatorColumnGridMode(componentId: string): "select" | "rename" | null {
  if (componentId === "rename_columns" || componentId === "field_mapper" || componentId === "dynamic_rename") {
    return "rename";
  }
  if (
    componentId === "select_columns" ||
    componentId === "project_columns" ||
    componentId === "column_select"
  ) {
    return "select";
  }
  return null;
}
