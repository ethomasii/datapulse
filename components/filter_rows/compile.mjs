// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// web/lib/elt/native-components/definitions/_config-helpers.ts
function inputTable(config) {
  return String(
    config.table ?? config.upstream_asset_key ?? config.input_table ?? config.source_table ?? ""
  ).trim();
}
function outputTable(config, fallback = "") {
  return String(config.output_table ?? config.asset_name ?? fallback).trim();
}

// web/lib/elt/native-components/definitions/_sql-helpers.ts
function sqlQualifiedTable(table) {
  const parts = table.split(".").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return table;
  return parts.map((p) => `"${p.replace(/"/g, '""')}"`).join(".");
}
function sqlCreateTableAs(output, selectSql) {
  return `CREATE OR REPLACE TABLE ${sqlQualifiedTable(output)} AS
${selectSql}`;
}
function isDataframeExecution(config) {
  const mode = String(config.execution ?? config.transform_mode ?? "warehouse").toLowerCase();
  return mode === "dataframe" || mode === "pandas" || mode === "worker";
}
function pandasQueryToSqlWhere(expr) {
  const s = expr.trim();
  if (!s) return s;
  if (/\s=\s/.test(s) && !/==/.test(s)) return s;
  return s.replace(/\s+and\s+/gi, " AND ").replace(/\s+or\s+/gi, " OR ").replace(/==/g, " = ").replace(/!=/g, " <> ").replace(/\s+in\s+\(/gi, " IN (").trim();
}

// web/lib/elt/native-components/definitions/filter-rows.ts
function compileFilterRowsDataframe(table, condition, output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return [
    `# \u2500\u2500 filter_rows (dataframe): ${table} \u2500\u2500`,
    "import pandas as pd",
    "try:",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`,
    `    _filtered = _df.query(${JSON.stringify(condition)})`,
    `    _filtered.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
    `    print(f"[filter_rows] kept {len(_filtered)} / {len(_df)} rows \u2192 ${escapePyString(output)}")`,
    "except Exception as _filt_err:",
    '    print(f"[filter_rows] failed: {_filt_err}")',
    "    raise"
  ];
}
var filterRowsComponent = {
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
      placeholder: "staging.events"
    },
    {
      key: "condition",
      label: "Filter condition",
      description: "SQL WHERE clause (default). Pandas query when execution=dataframe.",
      type: "text",
      required: true
    },
    {
      key: "output_table",
      label: "Output table",
      description: "Leave empty to overwrite source table",
      type: "string"
    },
    {
      key: "execution",
      label: "Execution",
      description: "warehouse = SQL push-down (default); dataframe = worker pandas",
      type: "select",
      options: ["warehouse", "dataframe"],
      default: "warehouse"
    }
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
        `SELECT *
FROM ${src}
WHERE ${where}`
      )
    ];
    return { sql };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/filter_rows.ts
function compile(config) {
  return filterRowsComponent.compile(config);
}
export {
  compile
};
