import type { NativeComponentDefinition } from "../types";
import { pandasReadTable, pandasWriteTable, strList } from "./_pandas-helpers";
import {
  sqlCreateTableAs,
  sqlQuotedColumns,
  sqlQualifiedTable,
  useDataframeExecution,
} from "./_sql-helpers";

export const selectColumnsComponent: NativeComponentDefinition = {
  id: "select_columns",
  aliases: ["project_columns", "column_select"],
  name: "Select columns",
  category: "transformation",
  description: "Project a subset of columns via warehouse SQL (default) or dataframe.",
  compileTarget: "warehouse",
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
    {
      key: "execution",
      label: "Execution",
      type: "select",
      options: ["warehouse", "dataframe"],
      default: "warehouse",
    },
  ],
  compile(config) {
    const table = String(config.table ?? config.asset_name ?? "").trim();
    const columns = strList(config.columns ?? config.column_names);
    const output = String(config.output_table ?? table).trim();
    if (!table || !columns.length) {
      return { warnings: ["select_columns: table and columns are required"], sql: [], python: [] };
    }

    if (useDataframeExecution(config)) {
      const colsPy = `[${columns.map((c) => JSON.stringify(c)).join(", ")}]`;
      const python = [
        `# ── select_columns (dataframe): ${table} ──`,
        "try:",
        ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
        `    _df = _df[${colsPy}]`,
        ...pandasWriteTable(output, "select_columns"),
        "except Exception as _sel_err:",
        '    print(f"[select_columns] failed: {_sel_err}")',
        "    raise",
      ];
      return { python };
    }

    const sql = [
      sqlCreateTableAs(
        output,
        `SELECT ${sqlQuotedColumns(columns)}\nFROM ${sqlQualifiedTable(table)}`
      ),
    ];
    return { sql };
  },
};
