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

// web/lib/elt/native-components/definitions/column-ops.ts
var castColumnsComponent = {
  id: "cast_columns",
  aliases: ["make_columns"],
  name: "Cast columns",
  category: "transformation",
  description: "Cast column dtypes after load (pandas astype).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "dtypes",
      label: "Dtype mapping",
      description: 'JSON object column \u2192 dtype, e.g. {"amount":"float64","created_at":"datetime64[ns]"}',
      type: "text",
      required: true
    },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    let dtypes = {};
    const raw = config.dtypes ?? config.column_types ?? config.cast;
    if (typeof raw === "string") {
      try {
        dtypes = JSON.parse(raw);
      } catch {
        return { warnings: ["cast_columns: dtypes must be valid JSON object"], python: [] };
      }
    } else if (raw && typeof raw === "object") {
      dtypes = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, String(v)])
      );
    }
    if (!table || !Object.keys(dtypes).length) {
      return { warnings: ["cast_columns: table and dtypes required"], python: [] };
    }
    const dtypesPy = JSON.stringify(dtypes);
    const python = [
      `# \u2500\u2500 cast_columns: ${table} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df = _df.astype(${dtypesPy})`,
      ...pandasWriteTable(output, "cast_columns"),
      "except Exception as _cast_err:",
      '    print(f"[cast_columns] failed: {_cast_err}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-rug7fN/cast_columns.ts
function compile(config) {
  return castColumnsComponent.compile(config);
}
export {
  compile
};
