// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function parseTableParts(table) {
  const parts = table.split(".");
  if (parts.length > 1) {
    return { schema: parts[0], name: parts.slice(1).join(".") };
  }
  return { schema: "public", name: table };
}
function pandasReadTable(table) {
  return [
    "import pandas as pd",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`
  ];
}
function pandasWriteTable(outputTable2, label) {
  const { schema, name } = parseTableParts(outputTable2);
  return [
    `    _df.to_sql("${escapePyString(name)}", _sql._engine, schema="${escapePyString(schema)}", if_exists="replace", index=False)`,
    `    print(f"[${label}] wrote {len(_df)} rows to ${escapePyString(outputTable2)}")`
  ];
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

// web/lib/elt/native-components/definitions/table-ops.ts
var limitRowsComponent = {
  id: "limit_rows",
  aliases: ["head_rows", "take_rows"],
  name: "Limit rows",
  category: "transformation",
  description: "Keep first N rows via warehouse SQL LIMIT (default) or dataframe head.",
  compileTarget: "warehouse",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "limit", label: "Row limit", type: "number", default: 1e3, required: true },
    { key: "output_table", label: "Output table", type: "string" },
    {
      key: "execution",
      label: "Execution",
      type: "select",
      options: ["warehouse", "dataframe"],
      default: "warehouse"
    }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    const limit = Math.max(1, Math.floor(Number(config.limit ?? config.n ?? 1e3)));
    if (!table) return { warnings: ["limit_rows: table required"], sql: [], python: [] };
    if (isDataframeExecution(config)) {
      const python = [
        `# \u2500\u2500 limit_rows (dataframe): ${table} (n=${limit}) \u2500\u2500`,
        "try:",
        ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
        `    _df = _df.head(${limit})`,
        ...pandasWriteTable(output, "limit_rows"),
        "except Exception as _lim_err:",
        '    print(f"[limit_rows] failed: {_lim_err}")',
        "    raise"
      ];
      return { python };
    }
    const sql = [
      sqlCreateTableAs(
        output,
        `SELECT *
FROM ${sqlQualifiedTable(table)}
LIMIT ${limit}`
      )
    ];
    return { sql };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/limit_rows.ts
function compile(config) {
  return limitRowsComponent.compile(config);
}
export {
  compile
};
