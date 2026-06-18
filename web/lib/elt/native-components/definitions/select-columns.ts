import { escapePyString } from "@/lib/elt/escape-py";
import type { NativeComponentDefinition } from "../types";
import { pandasReadTable, pandasWriteTable, strList } from "./_pandas-helpers";

export const selectColumnsComponent: NativeComponentDefinition = {
  id: "select_columns",
  name: "Select columns",
  category: "transformation",
  description: "Project a subset of columns from a loaded table.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "columns",
      label: "Columns",
      type: "string_list",
      required: true,
      placeholder: "id, name, created_at",
    },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = String(config.table ?? config.asset_name ?? "").trim();
    const columns = strList(config.columns ?? config.column_names);
    const output = String(config.output_table ?? table).trim();
    if (!table || !columns.length) {
      return { warnings: ["select_columns: table and columns are required"], python: [] };
    }
    const colsPy = `[${columns.map((c) => `"${escapePyString(c)}"`).join(", ")}]`;
    const python = [
      `# ── select_columns: ${table} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df[${colsPy}]`,
      ...pandasWriteTable(output, "select_columns"),
      "except Exception as _sel_err:",
      '    print(f"[select_columns] failed: {_sel_err}")',
      "    raise",
    ];
    return { python };
  },
};
