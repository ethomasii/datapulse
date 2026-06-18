// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
function pandasWriteTable(outputTable, label) {
  const { schema, name } = parseTableParts(outputTable);
  return [
    `    _df.to_sql("${escapePyString(name)}", _sql._engine, schema="${escapePyString(schema)}", if_exists="replace", index=False)`,
    `    print(f"[${label}] wrote {len(_df)} rows to ${escapePyString(outputTable)}")`
  ];
}

// web/lib/elt/native-components/definitions/column-ops.ts
var renameColumnsComponent = {
  id: "rename_columns",
  aliases: ["dynamic_rename", "field_mapper"],
  name: "Rename columns",
  category: "transformation",
  description: "Rename columns on a loaded table (pandas).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "mapping",
      label: "Column mapping",
      description: 'JSON object old_name \u2192 new_name, e.g. {"id":"order_id"}',
      type: "text",
      required: true
    },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    let mapping = {};
    const raw = config.mapping ?? config.column_mapping ?? config.rename_map;
    if (typeof raw === "string") {
      try {
        mapping = JSON.parse(raw);
      } catch {
        return { warnings: ["rename_columns: mapping must be valid JSON object"], python: [] };
      }
    } else if (raw && typeof raw === "object") {
      mapping = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, String(v)])
      );
    }
    if (!table || !Object.keys(mapping).length) {
      return { warnings: ["rename_columns: table and mapping required"], python: [] };
    }
    const mapPy = JSON.stringify(mapping);
    const python = [
      `# \u2500\u2500 rename_columns: ${table} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df = _df.rename(columns=${mapPy})`,
      ...pandasWriteTable(output, "rename_columns"),
      "except Exception as _ren_err:",
      '    print(f"[rename_columns] failed: {_ren_err}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-gKMp94/rename_columns.ts
function compile(config) {
  return renameColumnsComponent.compile(config);
}
export {
  compile
};
