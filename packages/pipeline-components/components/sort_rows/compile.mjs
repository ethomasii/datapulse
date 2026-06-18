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

// web/lib/elt/native-components/definitions/table-ops.ts
var sortRowsComponent = {
  id: "sort_rows",
  name: "Sort rows",
  category: "transformation",
  description: "Sort a table by one or more columns.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "columns", label: "Sort columns", type: "string_list", required: true },
    {
      key: "ascending",
      label: "Ascending",
      description: "true/false or comma list matching columns",
      type: "string",
      default: "true"
    },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    const columns = strList(config.columns ?? config.sort_by);
    const ascRaw = String(config.ascending ?? "true").trim();
    const ascPy = columns.length > 1 && ascRaw.includes(",") ? `[${ascRaw.split(",").map((s) => s.trim().toLowerCase() !== "false" ? "True" : "False").join(", ")}]` : ascRaw.toLowerCase() !== "false" ? "True" : "False";
    if (!table || !columns.length) {
      return { warnings: ["sort_rows: table and columns required"], python: [] };
    }
    const colsPy = `[${columns.map((c) => JSON.stringify(c)).join(", ")}]`;
    const python = [
      `# \u2500\u2500 sort_rows: ${table} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df = _df.sort_values(by=${colsPy}, ascending=${ascPy})`,
      ...pandasWriteTable(output, "sort_rows"),
      "except Exception as _sort_err:",
      '    print(f"[sort_rows] failed: {_sort_err}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-ywkMkX/sort_rows.ts
function compile(config) {
  return sortRowsComponent.compile(config);
}
export {
  compile
};
