// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function pandasReadTable(table) {
  return [
    "import pandas as pd",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`
  ];
}
function strList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// web/lib/elt/native-components/definitions/analytics-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var datetimeParserComponent = {
  id: "datetime_parser",
  aliases: ["parse_dates", "date_parser"],
  name: "Parse datetime columns",
  category: "transformation",
  description: "Parse string columns to datetime with optional format.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "columns", label: "Columns to parse", type: "string_list", required: true },
    { key: "format", label: "strftime format (optional)", type: "string", placeholder: "%Y-%m-%d" },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    const columns = strList(config.columns ?? config.date_columns);
    const fmt = String(config.format ?? "").trim();
    if (!table || !columns.length) {
      return { warnings: ["datetime_parser: table and columns required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const lines = [
      `# \u2500\u2500 datetime_parser: ${table} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`)
    ];
    for (const col of columns) {
      if (fmt) {
        lines.push(`    _df[${JSON.stringify(col)}] = pd.to_datetime(_df[${JSON.stringify(col)}], format=${JSON.stringify(fmt)}, errors='coerce')`);
      } else {
        lines.push(`    _df[${JSON.stringify(col)}] = pd.to_datetime(_df[${JSON.stringify(col)}], errors='coerce')`);
      }
    }
    lines.push(
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[datetime_parser] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[datetime_parser] failed: {_e}")',
      "    raise"
    );
    return { python: lines };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-0FtTsZ/datetime_parser.ts
function compile(config) {
  return datetimeParserComponent.compile(config);
}
export {
  compile
};
