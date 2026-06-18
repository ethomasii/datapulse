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

// web/lib/elt/native-components/definitions/advanced-transforms.ts
function parseJsonObject(raw, label) {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw;
  }
  return null;
}
var nestedFieldExtractorComponent = {
  id: "nested_field_extractor",
  aliases: ["json_path_extractor", "dot_path_extractor"],
  name: "Nested field extractor",
  category: "transformation",
  description: "Extract dot-path fields from JSON/dict columns into flat columns.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Nested column", type: "string", required: true },
    {
      key: "paths",
      label: "Path mapping",
      description: 'JSON object path \u2192 column, e.g. {"user.email":"email"}',
      type: "text",
      required: true
    },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.nested_column ?? "").trim();
    const paths = parseJsonObject(config.paths ?? config.field_paths ?? config.mapping, "paths");
    if (!table || !column || !paths || !Object.keys(paths).length) {
      return { warnings: ["nested_field_extractor: table, column, paths required"], python: [] };
    }
    const lines = [
      `# \u2500\u2500 nested_field_extractor: ${table}.${column} \u2500\u2500`,
      "import json",
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _src_col = ${JSON.stringify(column)}`,
      "    def _get_path(_obj, _path):",
      "        _cur = _obj",
      "        for _p in _path.split('.'):",
      "            if not isinstance(_cur, dict) or _p not in _cur: return None",
      "            _cur = _cur[_p]",
      "        return _cur",
      "    def _parse_cell(_v):",
      "        if isinstance(_v, dict): return _v",
      "        if isinstance(_v, str):",
      "            try: return json.loads(_v)",
      "            except Exception: return {}",
      "        return {}"
    ];
    for (const [path, outName] of Object.entries(paths)) {
      lines.push(
        `    _df[${JSON.stringify(String(outName))}] = _df[_src_col].apply(lambda x: _get_path(_parse_cell(x), ${JSON.stringify(path)}))`
      );
    }
    lines.push(...pandasWriteTable(output, "nested_field_extractor"), "except Exception as _e:", '    print(f"[nested_field_extractor] failed: {_e}")', "    raise");
    return { python: lines };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/nested_field_extractor.ts
function compile(config) {
  return nestedFieldExtractorComponent.compile(config);
}
export {
  compile
};
