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
function strList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// web/lib/elt/native-components/definitions/advanced-transforms.ts
var hashComponent = {
  id: "hash",
  aliases: ["column_hash", "checksum"],
  name: "Hash columns",
  category: "transformation",
  description: "Compute MD5/SHA-1/SHA-256 hash of one or more columns.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "columns", label: "Columns to hash", type: "string_list" },
    { key: "algorithm", label: "Algorithm", type: "select", options: ["md5", "sha1", "sha256"], default: "sha256" },
    { key: "output_column", label: "Output column", type: "string", default: "hash" },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const columns = strList(config.columns ?? config.hash_columns);
    const algorithm = String(config.algorithm ?? "sha256").trim().toLowerCase();
    const outCol = String(config.output_column ?? "hash").trim();
    if (!table) return { warnings: ["hash: table required"], python: [] };
    const colsPy = columns.length ? `[${columns.map((c) => JSON.stringify(c)).join(", ")}]` : "list(_df.columns)";
    const lines = [
      `# \u2500\u2500 hash: ${table} \u2500\u2500`,
      "import hashlib",
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _algo = ${JSON.stringify(algorithm)}`,
      `    _cols = ${colsPy}`,
      "    def _row_hash(_row):",
      "        _s = '|'.join(str(_row[c]) for c in _cols)",
      "        _b = _s.encode('utf-8')",
      "        if _algo == 'md5': return hashlib.md5(_b).hexdigest()",
      "        if _algo == 'sha1': return hashlib.sha1(_b).hexdigest()",
      "        return hashlib.sha256(_b).hexdigest()",
      `    _df[${JSON.stringify(outCol)}] = _df[_cols].apply(_row_hash, axis=1)`,
      ...pandasWriteTable(output, "hash"),
      "except Exception as _e:",
      '    print(f"[hash] failed: {_e}")',
      "    raise"
    ];
    return { python: lines };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/hash.ts
function compile(config) {
  return hashComponent.compile(config);
}
export {
  compile
};
