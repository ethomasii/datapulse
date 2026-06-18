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

// web/lib/elt/native-components/definitions/more-transforms.ts
var jsonFlattenComponent = {
  id: "json_flatten",
  aliases: ["json_path_extractor", "dataframe_flatten_nested_columns"],
  name: "JSON flatten",
  category: "transformation",
  description: "Flatten JSON object column into separate columns.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "JSON column", type: "string", required: true },
    { key: "drop_source", label: "Drop source column", type: "boolean", default: true },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.json_column ?? "").trim();
    const dropSource = config.drop_source !== false;
    if (!table || !column) {
      return { warnings: ["json_flatten: table and column required"], python: [] };
    }
    const lines = [
      `# \u2500\u2500 json_flatten: ${table}.${column} \u2500\u2500`,
      "import json",
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _parsed = _df[${JSON.stringify(column)}].apply(lambda x: json.loads(x) if isinstance(x, str) else (x if isinstance(x, dict) else {}))`,
      "    _flat = pd.json_normalize(_parsed)",
      "    _flat.columns = [str(c).replace('.', '_') for c in _flat.columns]",
      `    _df = _df.drop(columns=[${JSON.stringify(column)}]) if ${dropSource ? "True" : "False"} else _df`,
      "    _df = pd.concat([_df.reset_index(drop=True), _flat.reset_index(drop=True)], axis=1)",
      ...pandasWriteTable(output, "json_flatten"),
      "except Exception as _e:",
      '    print(f"[json_flatten] failed: {_e}")',
      "    raise"
    ];
    return { python: lines };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-gKMp94/json_flatten.ts
function compile(config) {
  return jsonFlattenComponent.compile(config);
}
export {
  compile
};
