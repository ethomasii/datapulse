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

// web/lib/elt/native-components/definitions/more-transforms.ts
var recordIdComponent = {
  id: "record_id",
  aliases: ["row_number", "surrogate_key"],
  name: "Record ID",
  category: "transformation",
  description: "Add monotonic row ID column.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "ID column name", type: "string", default: "record_id" },
    { key: "start_at", label: "Start at", type: "number", default: 1 },
    { key: "group_by", label: "Restart per group", type: "string_list" },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.output_column ?? "record_id").trim();
    const startAt = Math.floor(Number(config.start_at ?? 1));
    const groupBy = strList(config.group_by);
    if (!table) return { warnings: ["record_id: table required"], python: [] };
    const lines = [
      `# \u2500\u2500 record_id: ${table} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`)
    ];
    if (groupBy.length) {
      lines.push(
        `    _df[${JSON.stringify(column)}] = _df.groupby([${groupBy.map((c) => JSON.stringify(c)).join(", ")}]).cumcount() + ${startAt}`
      );
    } else {
      lines.push(`    _df[${JSON.stringify(column)}] = range(${startAt}, ${startAt} + len(_df))`);
    }
    lines.push(...pandasWriteTable(output, "record_id"), "except Exception as _e:", '    print(f"[record_id] failed: {_e}")', "    raise");
    return { python: lines };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/record_id.ts
function compile(config) {
  return recordIdComponent.compile(config);
}
export {
  compile
};
