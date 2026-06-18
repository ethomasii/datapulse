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

// web/lib/elt/native-components/definitions/union-tables.ts
var unionTablesComponent = {
  id: "union_tables",
  aliases: ["dataframe_union"],
  name: "Union tables",
  category: "transformation",
  description: "Stack multiple loaded tables (UNION ALL semantics via pandas concat).",
  compileTarget: "python",
  fields: [
    {
      key: "tables",
      label: "Tables",
      description: "Comma-separated schema.table names",
      type: "string_list",
      required: true
    },
    {
      key: "output_table",
      label: "Output table",
      type: "string",
      required: true
    },
    {
      key: "ignore_index",
      label: "Reset index",
      type: "boolean",
      default: true
    }
  ],
  compile(config) {
    const tables = strList(config.tables ?? config.input_tables);
    const output = String(config.output_table ?? config.asset_name ?? "").trim();
    if (tables.length < 2 || !output) {
      return {
        warnings: ["union_tables: at least two tables and output_table are required"],
        python: []
      };
    }
    const readLines = tables.flatMap((t, i) => [
      `    _df${i} = pd.read_sql('SELECT * FROM ${escapePyString(t)}', _sql._engine)`
    ]);
    const dfs = tables.map((_, i) => `_df${i}`).join(", ");
    const python = [
      `# \u2500\u2500 union_tables \u2192 ${output} \u2500\u2500`,
      "import pandas as pd",
      "try:",
      "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
      "    _sql = _dest_client.sql_client()",
      ...readLines,
      `    _df = pd.concat([${dfs}], ignore_index=${config.ignore_index !== false ? "True" : "False"})`,
      ...pandasWriteTable(output, "union_tables"),
      "except Exception as _union_err:",
      '    print(f"[union_tables] failed: {_union_err}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-0FtTsZ/union_tables.ts
function compile(config) {
  return unionTablesComponent.compile(config);
}
export {
  compile
};
