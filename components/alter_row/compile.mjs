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
var alterRowComponent = {
  id: "alter_row",
  aliases: ["cdc_marker", "change_type"],
  name: "Alter row (CDC)",
  category: "transformation",
  description: "Tag rows with CDC operation (insert/update/delete) based on conditions.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "delete_condition", label: "Delete condition", type: "string", description: "pandas query, e.g. status == 'deleted'" },
    { key: "update_condition", label: "Update condition", type: "string" },
    { key: "output_column", label: "Change type column", type: "string", default: "_change_type" },
    { key: "default_operation", label: "Default operation", type: "select", options: ["insert", "update", "upsert"], default: "insert" },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const deleteCond = String(config.delete_condition ?? "").trim();
    const updateCond = String(config.update_condition ?? "").trim();
    const outCol = String(config.output_column ?? "_change_type").trim();
    const defaultOp = String(config.default_operation ?? "insert").trim();
    if (!table) return { warnings: ["alter_row: table required"], python: [] };
    const lines = [
      `# \u2500\u2500 alter_row: ${table} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df[${JSON.stringify(outCol)}] = ${JSON.stringify(defaultOp)}`
    ];
    if (updateCond) {
      lines.push(`    _df.loc[_df.eval(${JSON.stringify(updateCond)}), ${JSON.stringify(outCol)}] = 'update'`);
    }
    if (deleteCond) {
      lines.push(`    _df.loc[_df.eval(${JSON.stringify(deleteCond)}), ${JSON.stringify(outCol)}] = 'delete'`);
    }
    lines.push(...pandasWriteTable(output, "alter_row"), "except Exception as _e:", '    print(f"[alter_row] failed: {_e}")', "    raise");
    return { python: lines };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/alter_row.ts
function compile(config) {
  return alterRowComponent.compile(config);
}
export {
  compile
};
