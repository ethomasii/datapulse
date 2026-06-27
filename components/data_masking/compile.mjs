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
var dataMaskingComponent = {
  id: "data_masking",
  aliases: ["pii_masking", "anonymize"],
  name: "Data masking",
  category: "transformation",
  description: "Rule-based PII masking: hash, partial mask, or full redact per column.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "policies",
      label: "Column policies",
      description: 'JSON e.g. {"email":{"method":"hash"},"ssn":{"method":"partial","visible":4}}',
      type: "text",
      required: true
    },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const policies = parseJsonObject(config.policies ?? config.masking_rules, "policies");
    if (!table || !policies || !Object.keys(policies).length) {
      return { warnings: ["data_masking: table and policies required"], python: [] };
    }
    const lines = [
      `# \u2500\u2500 data_masking: ${table} \u2500\u2500`,
      "import hashlib",
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _policies = ${JSON.stringify(policies)}`,
      "    for _col, _rule in _policies.items():",
      "        if _col not in _df.columns: continue",
      "        _method = str((_rule or {}).get('method', 'redact')).lower()",
      "        if _method == 'hash':",
      "            _df[_col] = _df[_col].astype(str).apply(lambda s: hashlib.sha256(s.encode()).hexdigest()[:16])",
      "        elif _method == 'partial':",
      "            _vis = int((_rule or {}).get('visible', 4))",
      "            _df[_col] = _df[_col].astype(str).apply(lambda s: '*' * max(0, len(s) - _vis) + s[-_vis:] if s else s)",
      "        else:",
      "            _df[_col] = '***REDACTED***'",
      ...pandasWriteTable(output, "data_masking"),
      "except Exception as _e:",
      '    print(f"[data_masking] failed: {_e}")',
      "    raise"
    ];
    return { python: lines };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/data_masking.ts
function compile(config) {
  return dataMaskingComponent.compile(config);
}
export {
  compile
};
