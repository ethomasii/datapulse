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
function strList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// web/lib/elt/native-components/definitions/drop-duplicates.ts
var dropDuplicatesComponent = {
  id: "drop_duplicates",
  aliases: ["unique_dedup", "warehouse_dedup"],
  name: "Drop duplicates",
  category: "transformation",
  description: "Deduplicate rows by key columns after load.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "subset",
      label: "Key columns",
      description: "Columns defining uniqueness (empty = all columns)",
      type: "string_list"
    },
    {
      key: "keep",
      label: "Keep",
      type: "select",
      options: ["first", "last", "false"],
      default: "first"
    },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = String(config.table ?? config.asset_name ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    const subset = strList(config.subset ?? config.unique_columns ?? config.key_columns);
    const keep = String(config.keep ?? "first").trim() || "first";
    if (!table) {
      return { warnings: ["drop_duplicates: table is required"], python: [] };
    }
    const subsetPy = subset.length ? `[${subset.map((c) => JSON.stringify(c)).join(", ")}]` : "None";
    const python = [
      `# \u2500\u2500 drop_duplicates: ${table} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _before = len(_df)`,
      `    _df = _df.drop_duplicates(subset=${subsetPy}, keep=${JSON.stringify(keep)})`,
      ...pandasWriteTable(output, "drop_duplicates"),
      `    print(f"[drop_duplicates] removed {_before - len(_df)} duplicate rows")`,
      "except Exception as _dedup_err:",
      '    print(f"[drop_duplicates] failed: {_dedup_err}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-0FtTsZ/drop_duplicates.ts
function compile(config) {
  return dropDuplicatesComponent.compile(config);
}
export {
  compile
};
