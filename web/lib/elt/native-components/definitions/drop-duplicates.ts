import type { NativeComponentDefinition } from "../types";
import { pandasReadTable, pandasWriteTable, strList } from "./_pandas-helpers";
import {
  sqlCreateTableAs,
  sqlDedupeSelect,
  sqlQualifiedTable,
  useDataframeExecution,
} from "./_sql-helpers";

export const dropDuplicatesComponent: NativeComponentDefinition = {
  id: "drop_duplicates",
  aliases: ["unique_dedup", "warehouse_dedup"],
  name: "Drop duplicates",
  category: "transformation",
  description: "Deduplicate rows by key columns via warehouse SQL (default) or dataframe.",
  compileTarget: "dbt",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "subset",
      label: "Key columns",
      description: "Columns defining uniqueness (empty = all columns)",
      type: "string_list",
    },
    {
      key: "keep",
      label: "Keep",
      type: "select",
      options: ["first", "last", "false"],
      default: "first",
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
    const output = String(config.output_table ?? table).trim();
    const subset = strList(config.subset ?? config.unique_columns ?? config.key_columns);
    const keep = String(config.keep ?? "first").trim() || "first";

    if (!table) {
      return { warnings: ["drop_duplicates: table is required"], sql: [], python: [] };
    }

    if (useDataframeExecution(config)) {
      const subsetPy = subset.length
        ? `[${subset.map((c) => JSON.stringify(c)).join(", ")}]`
        : "None";
      const python = [
        `# ── drop_duplicates (dataframe): ${table} ──`,
        "try:",
        ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
        `    _before = len(_df)`,
        `    _df = _df.drop_duplicates(subset=${subsetPy}, keep=${JSON.stringify(keep)})`,
        ...pandasWriteTable(output, "drop_duplicates"),
        `    print(f"[drop_duplicates] removed {_before - len(_df)} duplicate rows")`,
        "except Exception as _dedup_err:",
        '    print(f"[drop_duplicates] failed: {_dedup_err}")',
        "    raise",
      ];
      return { python };
    }

    const sql = [sqlCreateTableAs(output, sqlDedupeSelect(table, subset, keep))];
    return { sql };
  },
};
