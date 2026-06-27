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
var appendFieldsComponent = {
  id: "append_fields",
  aliases: ["broadcast_join", "lookup_append"],
  name: "Append fields",
  category: "transformation",
  description: "Broadcast-append columns from a small lookup table to every row.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Main table", type: "string", required: true },
    { key: "lookup_table", label: "Lookup table", type: "string", required: true },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = inputTable(config);
    const lookup = String(config.lookup_table ?? config.source_table ?? "").trim();
    const output = outputTable(config);
    if (!table || !lookup || !output) {
      return { warnings: ["append_fields: table, lookup_table, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const python = [
      `# \u2500\u2500 append_fields: ${table} + ${lookup} \u2500\u2500`,
      "import pandas as pd",
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _lookup = pd.read_sql('SELECT * FROM ${escapePyString(lookup)}', _sql._engine)`,
      "    _lookup['_append_key'] = 1",
      "    _df['_append_key'] = 1",
      "    _df = _df.merge(_lookup, on='_append_key').drop(columns=['_append_key'])",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[append_fields] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[append_fields] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/append_fields.ts
function compile(config) {
  return appendFieldsComponent.compile(config);
}
export {
  compile
};
