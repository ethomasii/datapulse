import { escapePyString } from "@/lib/elt/escape-py";
import type { NativeComponentDefinition } from "../types";
import { pandasWriteTable, strList } from "./_pandas-helpers";
import { isDataframeExecution, sqlCreateTableAs, sqlQualifiedTable } from "./_sql-helpers";

function compileUnionDataframe(tables: string[], output: string, ignoreIndex: boolean): string[] {
  const readLines = tables.flatMap((t, i) => [
    `    _df${i} = pd.read_sql('SELECT * FROM ${escapePyString(t)}', _sql._engine)`,
  ]);
  const dfs = tables.map((_, i) => `_df${i}`).join(", ");

  return [
    `# ── union_tables (dataframe) → ${output} ──`,
    "import pandas as pd",
    "try:",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    ...readLines,
    `    _df = pd.concat([${dfs}], ignore_index=${ignoreIndex ? "True" : "False"})`,
    ...pandasWriteTable(output, "union_tables"),
    "except Exception as _union_err:",
    '    print(f"[union_tables] failed: {_union_err}")',
    "    raise",
  ];
}

export const unionTablesComponent: NativeComponentDefinition = {
  id: "union_tables",
  aliases: ["dataframe_union", "warehouse_union"],
  name: "Union",
  category: "transformation",
  description: "Stack tables with UNION ALL in warehouse SQL (default) or pandas concat when execution=dataframe.",
  compileTarget: "warehouse",
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
      description: "Dataframe mode only — ignored for warehouse SQL",
      type: "boolean",
      default: true,
    },
    {
      key: "execution",
      label: "Execution",
      description: "warehouse = SQL push-down (default); dataframe = worker pandas",
      type: "select",
      options: ["warehouse", "dataframe"],
      default: "warehouse",
    },
  ],
  compile(config) {
    const tables = strList(config.tables ?? config.input_tables);
    const output = String(config.output_table ?? config.asset_name ?? "").trim();
    if (tables.length < 2 || !output) {
      return {
        warnings: ["union_tables: at least two tables and output_table are required"],
        sql: [],
        python: [],
      };
    }

    if (isDataframeExecution(config)) {
      return {
        python: compileUnionDataframe(tables, output, config.ignore_index !== false),
      };
    }

    const unionSql = tables.map((t) => `SELECT * FROM ${sqlQualifiedTable(t)}`).join("\nUNION ALL\n");
    return {
      sql: [sqlCreateTableAs(output, unionSql)],
    };
  },
};
