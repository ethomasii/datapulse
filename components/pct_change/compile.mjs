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
var pctChangeComponent = {
  id: "pct_change",
  aliases: ["period_over_period", "growth_rate"],
  name: "Percent change",
  category: "transformation",
  description: "Period-over-period diff and percent change on a value column.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Value column", type: "string", required: true },
    { key: "group_by", label: "Group by", type: "string_list" },
    { key: "order_by", label: "Order by", type: "string_list", required: true },
    { key: "periods", label: "Periods", type: "number", default: 1 },
    { key: "output_column", label: "Output column", type: "string", default: "pct_change" },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.value_column ?? "").trim();
    const groupBy = strList(config.group_by);
    const orderBy = strList(config.order_by ?? config.time_column);
    const periods = Math.max(1, Math.floor(Number(config.periods ?? 1)));
    const outCol = String(config.output_column ?? "pct_change").trim();
    if (!table || !column || !orderBy.length) {
      return { warnings: ["pct_change: table, column, order_by required"], python: [] };
    }
    const lines = [
      `# \u2500\u2500 pct_change: ${table}.${column} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df = _df.sort_values(by=[${orderBy.map((c) => JSON.stringify(c)).join(", ")}])`
    ];
    const colPy = JSON.stringify(column);
    if (groupBy.length) {
      const groupPy = `[${groupBy.map((c) => JSON.stringify(c)).join(", ")}]`;
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df.groupby(${groupPy})[${colPy}].pct_change(periods=${periods})`);
    } else {
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df[${colPy}].pct_change(periods=${periods})`);
    }
    lines.push(...pandasWriteTable(output, "pct_change"), "except Exception as _e:", '    print(f"[pct_change] failed: {_e}")', "    raise");
    return { python: lines };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/pct_change.ts
function compile(config) {
  return pctChangeComponent.compile(config);
}
export {
  compile
};
