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

// web/lib/elt/native-components/definitions/select-columns.ts
var selectColumnsComponent = {
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
      placeholder: "id, name, created_at"
    },
    { key: "output_table", label: "Output table", type: "string" }
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
      `# \u2500\u2500 select_columns: ${table} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df = _df[${colsPy}]`,
      ...pandasWriteTable(output, "select_columns"),
      "except Exception as _sel_err:",
      '    print(f"[select_columns] failed: {_sel_err}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-gKMp94/select_columns.ts
function compile(config) {
  return selectColumnsComponent.compile(config);
}
export {
  compile
};
