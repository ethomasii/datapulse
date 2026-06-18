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
var sampleRowsComponent = {
  id: "sample_rows",
  name: "Sample rows",
  category: "transformation",
  description: "Random sample of rows (pandas sample).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "n", label: "Sample size", type: "number", default: 1e3 },
    {
      key: "frac",
      label: "Fraction (0\u20131)",
      description: "Use instead of n for proportional sample",
      type: "number"
    },
    { key: "random_state", label: "Random seed", type: "number" },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? "").trim();
    const n = config.n != null ? Math.max(1, Math.floor(Number(config.n))) : null;
    const frac = config.frac != null ? Number(config.frac) : null;
    const seed = config.random_state != null ? Math.floor(Number(config.random_state)) : null;
    if (!table || !output || n == null && frac == null) {
      return { warnings: ["sample_rows: table, output_table, and n or frac required"], python: [] };
    }
    const sampleKw = frac != null && !Number.isNaN(frac) ? `frac=${frac}${seed != null ? `, random_state=${seed}` : ""}` : `n=${n ?? 1e3}${seed != null ? `, random_state=${seed}` : ""}`;
    const python = [
      `# \u2500\u2500 sample_rows: ${table} \u2192 ${output} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df = _df.sample(${sampleKw})`,
      ...pandasWriteTable(output, "sample_rows"),
      "except Exception as _samp_err:",
      '    print(f"[sample_rows] failed: {_samp_err}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-ywkMkX/sample_rows.ts
function compile(config) {
  return sampleRowsComponent.compile(config);
}
export {
  compile
};
