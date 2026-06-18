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

// web/lib/elt/native-components/definitions/table-ops.ts
var fillNullsComponent = {
  id: "fill_nulls",
  aliases: ["impute_nulls"],
  name: "Fill nulls",
  category: "transformation",
  description: "Fill null values with constants per column (pandas fillna).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "values",
      label: "Fill values JSON",
      description: 'e.g. {"status":"unknown","amount":0}',
      type: "text",
      required: true
    },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    let values = {};
    const raw = config.values ?? config.fillna;
    if (typeof raw === "string") {
      try {
        values = JSON.parse(raw);
      } catch {
        return { warnings: ["fill_nulls: values must be valid JSON"], python: [] };
      }
    } else if (raw && typeof raw === "object") {
      values = raw;
    }
    if (!table || !Object.keys(values).length) {
      return { warnings: ["fill_nulls: table and values required"], python: [] };
    }
    const valuesPy = JSON.stringify(values);
    const python = [
      `# \u2500\u2500 fill_nulls: ${table} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df = _df.fillna(${valuesPy})`,
      ...pandasWriteTable(output, "fill_nulls"),
      "except Exception as _fill_err:",
      '    print(f"[fill_nulls] failed: {_fill_err}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-ywkMkX/fill_nulls.ts
function compile(config) {
  return fillNullsComponent.compile(config);
}
export {
  compile
};
