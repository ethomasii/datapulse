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
var arrayExploderComponent = {
  id: "array_exploder",
  aliases: ["explode_array", "unnest"],
  name: "Array exploder",
  category: "transformation",
  description: "Expand an array column so each element becomes its own row.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Array column", type: "string", required: true },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const column = String(config.column ?? config.array_column ?? "").trim();
    if (!table || !output || !column) {
      return { warnings: ["array_exploder: table, column, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const python = [
      `# \u2500\u2500 array_exploder: ${table}.${column} \u2500\u2500`,
      "import json",
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _col = ${JSON.stringify(column)}`,
      "    def _to_list(_v):",
      "        if isinstance(_v, list): return _v",
      "        if isinstance(_v, str):",
      "            try: return json.loads(_v)",
      "            except Exception: return [_v]",
      "        return [_v]",
      "    _df[_col] = _df[_col].apply(_to_list)",
      "    _df = _df.explode(_col, ignore_index=True)",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[array_exploder] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[array_exploder] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/array_exploder.ts
function compile(config) {
  return arrayExploderComponent.compile(config);
}
export {
  compile
};
