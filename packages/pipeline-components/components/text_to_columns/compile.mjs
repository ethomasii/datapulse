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
var textToColumnsComponent = {
  id: "text_to_columns",
  aliases: ["split_column", "parse_text"],
  name: "Text to columns",
  category: "transformation",
  description: "Split a string column into multiple columns.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Source column", type: "string", required: true },
    { key: "delimiter", label: "Delimiter", type: "string", default: "," },
    { key: "output_columns", label: "Output column names", type: "string_list" },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? "").trim();
    const delimiter = String(config.delimiter ?? config.sep ?? ",").trim();
    const outCols = strList(config.output_columns ?? config.new_columns);
    if (!table || !column) {
      return { warnings: ["text_to_columns: table and column required"], python: [] };
    }
    const lines = [
      `# \u2500\u2500 text_to_columns: ${table}.${column} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _split = _df[${JSON.stringify(column)}].astype(str).str.split(${JSON.stringify(delimiter)}, expand=True)`
    ];
    if (outCols.length) {
      for (let i = 0; i < outCols.length; i++) {
        lines.push(`    _df[${JSON.stringify(outCols[i])}] = _split[${i}]`);
      }
    } else {
      lines.push("    _df = _df.join(_split.add_prefix(f'{column}_'))");
    }
    lines.push(...pandasWriteTable(output, "text_to_columns"), "except Exception as _e:", '    print(f"[text_to_columns] failed: {_e}")', "    raise");
    return { python: lines };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-0FtTsZ/text_to_columns.ts
function compile(config) {
  return textToColumnsComponent.compile(config);
}
export {
  compile
};
