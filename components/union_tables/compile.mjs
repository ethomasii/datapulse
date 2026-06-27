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
function pandasWriteTable(outputTable, label) {
  const { schema, name } = parseTableParts(outputTable);
  return [
    `    _df.to_sql("${escapePyString(name)}", _sql._engine, schema="${escapePyString(schema)}", if_exists="replace", index=False)`,
    `    print(f"[${label}] wrote {len(_df)} rows to ${escapePyString(outputTable)}")`
  ];
}
function strList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
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

// web/lib/elt/native-components/definitions/union-tables.ts
function compileUnionDataframe(tables, output, ignoreIndex) {
  const readLines = tables.flatMap((t, i) => [
    `    _df${i} = pd.read_sql('SELECT * FROM ${escapePyString(t)}', _sql._engine)`
  ]);
  const dfs = tables.map((_, i) => `_df${i}`).join(", ");
  return [
    `# \u2500\u2500 union_tables (dataframe) \u2192 ${output} \u2500\u2500`,
    "import pandas as pd",
    "try:",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    ...readLines,
    `    _df = pd.concat([${dfs}], ignore_index=${ignoreIndex ? "True" : "False"})`,
    ...pandasWriteTable(output, "union_tables"),
    "except Exception as _union_err:",
    '    print(f"[union_tables] failed: {_union_err}")',
    "    raise"
  ];
}
var unionTablesComponent = {
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
      required: true
    },
    {
      key: "output_table",
      label: "Output table",
      type: "string",
      required: true
    },
    {
      key: "ignore_index",
      label: "Reset index",
      description: "Dataframe mode only \u2014 ignored for warehouse SQL",
      type: "boolean",
      default: true
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
    const tables = strList(config.tables ?? config.input_tables);
    const output = String(config.output_table ?? config.asset_name ?? "").trim();
    if (tables.length < 2 || !output) {
      return {
        warnings: ["union_tables: at least two tables and output_table are required"],
        sql: [],
        python: []
      };
    }
    if (isDataframeExecution(config)) {
      return {
        python: compileUnionDataframe(tables, output, config.ignore_index !== false)
      };
    }
    const unionSql = tables.map((t) => `SELECT * FROM ${sqlQualifiedTable(t)}`).join("\nUNION ALL\n");
    return {
      sql: [sqlCreateTableAs(output, unionSql)]
    };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/union_tables.ts
function compile(config) {
  return unionTablesComponent.compile(config);
}
export {
  compile
};
