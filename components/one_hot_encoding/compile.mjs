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
function strList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// web/lib/elt/native-components/definitions/more-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var oneHotEncodingComponent = {
  id: "one_hot_encoding",
  aliases: ["get_dummies", "dummy_encode"],
  name: "One-hot encoding",
  category: "transformation",
  description: "One-hot encode categorical columns (pandas get_dummies).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "columns", label: "Columns to encode", type: "string_list", required: true },
    { key: "drop_first", label: "Drop first category", type: "boolean", default: false },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const columns = strList(config.columns ?? config.categorical_columns);
    const dropFirst = config.drop_first === true;
    if (!table || !output || !columns.length) {
      return { warnings: ["one_hot_encoding: table, columns, output_table required"], python: [] };
    }
    const colsPy = `[${columns.map((c) => JSON.stringify(c)).join(", ")}]`;
    const { outSchema, outName } = outputParts(output);
    const python = [
      `# \u2500\u2500 one_hot_encoding: ${table} \u2192 ${output} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _dummies = pd.get_dummies(_df[${colsPy}], drop_first=${dropFirst ? "True" : "False"})`,
      `    _df = pd.concat([_df.drop(columns=${colsPy}, errors='ignore'), _dummies], axis=1)`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[one_hot_encoding] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[one_hot_encoding] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/one_hot_encoding.ts
function compile(config) {
  return oneHotEncodingComponent.compile(config);
}
export {
  compile
};
