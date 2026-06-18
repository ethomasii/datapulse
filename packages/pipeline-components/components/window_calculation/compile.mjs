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

// web/lib/elt/native-components/definitions/advanced-transforms.ts
var windowCalculationComponent = {
  id: "window_calculation",
  aliases: ["window_function", "analytic_function"],
  name: "Window calculation",
  category: "transformation",
  description: "Window functions: lag, lead, rank, row_number, cumsum, rolling mean.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Value column", type: "string", required: true },
    {
      key: "function",
      label: "Function",
      type: "select",
      options: ["lag", "lead", "rank", "dense_rank", "row_number", "cumsum", "rolling_mean"],
      default: "lag"
    },
    { key: "partition_by", label: "Partition by", type: "string_list" },
    { key: "order_by", label: "Order by", type: "string_list" },
    { key: "periods", label: "Lag/lead periods", type: "number", default: 1 },
    { key: "window", label: "Rolling window size", type: "number", default: 3 },
    { key: "output_column", label: "Output column", type: "string" },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.value_column ?? "").trim();
    const fn = String(config.function ?? config.window_function ?? "lag").trim();
    const partitionBy = strList(config.partition_by ?? config.group_by);
    const orderBy = strList(config.order_by ?? config.sort_by);
    const periods = Math.max(1, Math.floor(Number(config.periods ?? 1)));
    const window = Math.max(1, Math.floor(Number(config.window ?? 3)));
    const outCol = String(config.output_column ?? `${column}_${fn}`).trim();
    if (!table || !column) {
      return { warnings: ["window_calculation: table and column required"], python: [] };
    }
    const lines = [
      `# \u2500\u2500 window_calculation: ${table}.${column} (${fn}) \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`)
    ];
    if (orderBy.length) {
      lines.push(`    _df = _df.sort_values(by=[${orderBy.map((c) => JSON.stringify(c)).join(", ")}])`);
    }
    const colPy = JSON.stringify(column);
    const partPy = partitionBy.length ? `[${partitionBy.map((c) => JSON.stringify(c)).join(", ")}]` : null;
    const grouped = partPy ? `_df.groupby(${partPy}, group_keys=False)` : "_df";
    if (fn === "rank") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = ${grouped}[${colPy}].rank(method='average')`);
    } else if (fn === "dense_rank") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = ${grouped}[${colPy}].rank(method='dense')`);
    } else if (fn === "row_number") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = ${grouped}.cumcount() + 1`);
    } else if (fn === "cumsum") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = ${grouped}[${colPy}].cumsum()`);
    } else if (fn === "rolling_mean") {
      lines.push(
        `    _df[${JSON.stringify(outCol)}] = ${grouped}[${colPy}].transform(lambda s: s.rolling(${window}, min_periods=1).mean())`
      );
    } else if (fn === "lead") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = ${grouped}[${colPy}].shift(-${periods})`);
    } else {
      lines.push(`    _df[${JSON.stringify(outCol)}] = ${grouped}[${colPy}].shift(${periods})`);
    }
    lines.push(...pandasWriteTable(output, "window_calculation"), "except Exception as _e:", '    print(f"[window_calculation] failed: {_e}")', "    raise");
    return { python: lines };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/window_calculation.ts
function compile(config) {
  return windowCalculationComponent.compile(config);
}
export {
  compile
};
