import { escapePyString } from "@/lib/elt/escape-py";
import type { NativeComponentDefinition } from "../types";
import { pandasWriteTable, strList } from "./_pandas-helpers";

export const unionTablesComponent: NativeComponentDefinition = {
  id: "union_tables",
  aliases: ["dataframe_union"],
  name: "Union tables",
  category: "transformation",
  description: "Stack multiple loaded tables (UNION ALL semantics via pandas concat).",
  compileTarget: "python",
  fields: [
    {
      key: "tables",
      label: "Tables",
      description: "Comma-separated schema.table names",
      type: "string_list",
      required: true,
    },
    {
      key: "output_table",
      label: "Output table",
      type: "string",
      required: true,
    },
    {
      key: "ignore_index",
      label: "Reset index",
      type: "boolean",
      default: true,
    },
  ],
  compile(config) {
    const tables = strList(config.tables ?? config.input_tables);
    const output = String(config.output_table ?? config.asset_name ?? "").trim();
    if (tables.length < 2 || !output) {
      return {
        warnings: ["union_tables: at least two tables and output_table are required"],
        python: [],
      };
    }

    const readLines = tables.flatMap((t, i) => [
      `    _df${i} = pd.read_sql('SELECT * FROM ${escapePyString(t)}', _sql._engine)`,
    ]);
    const dfs = tables.map((_, i) => `_df${i}`).join(", ");

    const python = [
      `# ── union_tables → ${output} ──`,
      "import pandas as pd",
      "try:",
      "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
      "    _sql = _dest_client.sql_client()",
      ...readLines,
      `    _df = pd.concat([${dfs}], ignore_index=${config.ignore_index !== false ? "True" : "False"})`,
      ...pandasWriteTable(output, "union_tables"),
      "except Exception as _union_err:",
      '    print(f"[union_tables] failed: {_union_err}")',
      "    raise",
    ];
    return { python };
  },
};
