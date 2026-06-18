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
var auditColumnsComponent = {
  id: "audit_columns",
  aliases: ["audit_columns_transform"],
  name: "Audit columns",
  category: "transformation",
  description: "Add created_at / updated_at / source metadata columns.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "add_created_at", label: "Add created_at", type: "boolean", default: true },
    { key: "add_updated_at", label: "Add updated_at", type: "boolean", default: true },
    { key: "source_label", label: "Source label column value", type: "string" },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const addCreated = config.add_created_at !== false;
    const addUpdated = config.add_updated_at !== false;
    const sourceLabel = String(config.source_label ?? config.source ?? "").trim();
    if (!table) return { warnings: ["audit_columns: table required"], python: [] };
    const lines = [
      `# \u2500\u2500 audit_columns: ${table} \u2500\u2500`,
      "from datetime import datetime, timezone",
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      "    _now = datetime.now(timezone.utc).isoformat()"
    ];
    if (addCreated) lines.push("    _df['created_at'] = _now");
    if (addUpdated) lines.push("    _df['updated_at'] = _now");
    if (sourceLabel) lines.push(`    _df['source'] = ${JSON.stringify(sourceLabel)}`);
    lines.push(...pandasWriteTable(output, "audit_columns"), "except Exception as _e:", '    print(f"[audit_columns] failed: {_e}")', "    raise");
    return { python: lines };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-gKMp94/audit_columns.ts
function compile(config) {
  return auditColumnsComponent.compile(config);
}
export {
  compile
};
