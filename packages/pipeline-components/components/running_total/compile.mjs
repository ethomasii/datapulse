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
var runningTotalComponent = {
  id: "running_total",
  aliases: ["cumulative_sum", "cumsum"],
  name: "Running total",
  category: "transformation",
  description: "Cumulative sum of a column, optionally per group.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Value column", type: "string", required: true },
    { key: "group_by", label: "Group by", type: "string_list" },
    { key: "sort_by", label: "Sort before cumsum", type: "string_list" },
    { key: "output_column", label: "Output column", type: "string", default: "running_total" },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.value_column ?? "").trim();
    const groupBy = strList(config.group_by);
    const sortBy = strList(config.sort_by ?? config.order_by);
    const outCol = String(config.output_column ?? "running_total").trim();
    if (!table || !column) {
      return { warnings: ["running_total: table and column required"], python: [] };
    }
    const lines = [
      `# \u2500\u2500 running_total: ${table} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`)
    ];
    if (sortBy.length) {
      lines.push(`    _df = _df.sort_values(by=[${sortBy.map((c) => JSON.stringify(c)).join(", ")}])`);
    }
    if (groupBy.length) {
      lines.push(
        `    _df[${JSON.stringify(outCol)}] = _df.groupby([${groupBy.map((c) => JSON.stringify(c)).join(", ")}])[${JSON.stringify(column)}].cumsum()`
      );
    } else {
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df[${JSON.stringify(column)}].cumsum()`);
    }
    lines.push(...pandasWriteTable(output, "running_total"), "except Exception as _e:", '    print(f"[running_total] failed: {_e}")', "    raise");
    return { python: lines };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-0FtTsZ/running_total.ts
function compile(config) {
  return runningTotalComponent.compile(config);
}
export {
  compile
};
