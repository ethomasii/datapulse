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
var limitRowsComponent = {
  id: "limit_rows",
  aliases: ["head_rows", "take_rows"],
  name: "Limit rows",
  category: "transformation",
  description: "Keep first N rows of a table (head).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "limit", label: "Row limit", type: "number", default: 1e3, required: true },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    const limit = Math.max(1, Math.floor(Number(config.limit ?? config.n ?? 1e3)));
    if (!table) return { warnings: ["limit_rows: table required"], python: [] };
    const python = [
      `# \u2500\u2500 limit_rows: ${table} (n=${limit}) \u2500\u2500`,
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
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-gKMp94/limit_rows.ts
function compile(config) {
  return limitRowsComponent.compile(config);
}
export {
  compile
};
