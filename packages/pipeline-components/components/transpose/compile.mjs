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

// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function pandasReadTable(table) {
  return [
    "import pandas as pd",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`
  ];
}

// web/lib/elt/native-components/definitions/advanced-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var transposeComponent = {
  id: "transpose",
  name: "Transpose",
  category: "transformation",
  description: "Transpose rows and columns (pandas transpose).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "index_column", label: "New index column name", type: "string", default: "field" },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const indexCol = String(config.index_column ?? "field").trim();
    if (!table || !output) {
      return { warnings: ["transpose: table and output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const python = [
      `# \u2500\u2500 transpose: ${table} \u2192 ${output} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df = _df.T.reset_index().rename(columns={'index': ${JSON.stringify(indexCol)}})`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[transpose] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[transpose] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/transpose.ts
function compile(config) {
  return transposeComponent.compile(config);
}
export {
  compile
};
