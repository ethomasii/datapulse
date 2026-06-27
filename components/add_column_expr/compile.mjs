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

// web/lib/elt/native-components/definitions/table-ops.ts
var addColumnExprComponent = {
  id: "add_column_expr",
  aliases: ["computed_column", "derive_column", "formula", "warehouse_formula", "multi_field_formula"],
  name: "Add computed column",
  category: "transformation",
  description: "Add a column via pandas eval expression.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "New column name", type: "string", required: true },
    {
      key: "expression",
      label: "Expression",
      description: "pandas eval, e.g. amount * 1.1",
      type: "text",
      required: true
    },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    const column = String(config.column ?? config.name ?? "").trim();
    const expression = String(config.expression ?? config.expr ?? "").trim();
    if (!table || !column || !expression) {
      return { warnings: ["add_column_expr: table, column, expression required"], python: [] };
    }
    const python = [
      `# \u2500\u2500 add_column_expr: ${table}.${column} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df[${JSON.stringify(column)}] = _df.eval(${JSON.stringify(expression)})`,
      ...pandasWriteTable(output, "add_column_expr"),
      "except Exception as _add_err:",
      '    print(f"[add_column_expr] failed: {_add_err}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/add_column_expr.ts
function compile(config) {
  return addColumnExprComponent.compile(config);
}
export {
  compile
};
