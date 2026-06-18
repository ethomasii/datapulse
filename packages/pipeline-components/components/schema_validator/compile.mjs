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
var schemaValidatorComponent = {
  id: "schema_validator",
  aliases: ["json_schema_validator"],
  name: "Schema validator",
  category: "transformation",
  description: "Validate JSON rows against a JSON Schema; drop, tag, or raise on failure.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "JSON column", type: "string", required: true },
    { key: "json_schema", label: "JSON Schema", type: "text", required: true },
    { key: "on_failure", label: "On failure", type: "select", options: ["drop", "tag", "raise"], default: "drop" },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const column = String(config.column ?? config.json_column ?? "").trim();
    const schemaRaw = String(config.json_schema ?? config.schema ?? "").trim();
    const onFailure = String(config.on_failure ?? "drop").trim();
    if (!table || !output || !column || !schemaRaw) {
      return { warnings: ["schema_validator: table, column, json_schema, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const python = [
      `# \u2500\u2500 schema_validator: ${table}.${column} \u2500\u2500`,
      "import json",
      "try:",
      "    import jsonschema",
      "except ImportError:",
      "    jsonschema = None",
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _schema = json.loads(${JSON.stringify(schemaRaw)})`,
      `    _col = ${JSON.stringify(column)}`,
      `    _on_fail = ${JSON.stringify(onFailure)}`,
      "    if jsonschema is None:",
      '        raise ImportError("jsonschema package required for schema_validator")',
      "    def _valid(_v):",
      "        try:",
      "            _obj = json.loads(_v) if isinstance(_v, str) else _v",
      "            jsonschema.validate(_obj, _schema)",
      "            return True",
      "        except Exception:",
      "            return False",
      "    _mask = _df[_col].apply(_valid)",
      "    if _on_fail == 'raise' and not _mask.all():",
      '        raise ValueError("schema validation failed for one or more rows")',
      "    if _on_fail == 'tag':",
      "        _df['_schema_valid'] = _mask",
      "    elif _on_fail == 'drop':",
      "        _df = _df[_mask]",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[schema_validator] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[schema_validator] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/schema_validator.ts
function compile(config) {
  return schemaValidatorComponent.compile(config);
}
export {
  compile
};
