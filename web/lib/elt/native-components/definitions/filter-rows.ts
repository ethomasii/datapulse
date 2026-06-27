import { escapePyString } from "@/lib/elt/escape-py";
import type { NativeComponentDefinition } from "../types";
import { inputTable, outputTable } from "./_config-helpers";
import {
  pandasQueryToSqlWhere,
  sqlCreateTableAs,
  sqlQualifiedTable,
  isDataframeExecution,
} from "./_sql-helpers";

function compileFilterRowsDataframe(
  table: string,
  condition: string,
  output: string
): string[] {
  const outSchema = output.includes(".") ? output.split(".")[0]! : "public";
  const outName = output.includes(".") ? output.split(".").pop()! : output;

  return [
    `# ── filter_rows (dataframe): ${table} ──`,
    "import pandas as pd",
    "try:",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`,
    `    _filtered = _df.query(${JSON.stringify(condition)})`,
    `    _filtered.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
    `    print(f"[filter_rows] kept {len(_filtered)} / {len(_df)} rows → ${escapePyString(output)}")`,
    "except Exception as _filt_err:",
    '    print(f"[filter_rows] failed: {_filt_err}")',
    "    raise",
  ];
}

export const filterRowsComponent: NativeComponentDefinition = {
  id: "filter_rows",
  aliases: ["dataframe_filter", "row_filter", "filter", "warehouse_filter", "select_records", "audience_segment"],
  name: "Filter",
  category: "transformation",
  description: "Filter rows in warehouse SQL (default) or in-memory dataframe when execution=dataframe.",
  compileTarget: "warehouse",
  fields: [
    {
      key: "table",
      label: "Table",
      type: "string",
      required: true,
      placeholder: "staging.events",
    },
    {
      key: "condition",
      label: "Filter condition",
      description: "SQL WHERE clause (default). Pandas query when execution=dataframe.",
      type: "text",
      required: true,
    },
    {
      key: "output_table",
      label: "Output table",
      description: "Leave empty to overwrite source table",
      type: "string",
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
    const table = inputTable(config);
    const condition = String(config.condition ?? config.filter ?? config.expression ?? "").trim();
    const output = outputTable(config, table);

    if (!table || !condition) {
      return { warnings: ["filter_rows: table and condition are required"], sql: [], python: [] };
    }

    if (isDataframeExecution(config)) {
      return { python: compileFilterRowsDataframe(table, condition, output) };
    }

    const where = pandasQueryToSqlWhere(condition);
    const src = sqlQualifiedTable(table);
    const sql = [
      sqlCreateTableAs(
        output,
        `SELECT *\nFROM ${src}\nWHERE ${where}`
      ),
    ];

    return { sql };
  },
};
