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
var multiRowFormulaComponent = {
  id: "multi_row_formula",
  aliases: ["lag_lead", "shift_formula"],
  name: "Multi-row formula",
  category: "transformation",
  description: "Lag, lead, or diff a column with optional grouping and ordering.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Source column", type: "string", required: true },
    { key: "operation", label: "Operation", type: "select", options: ["lag", "lead", "diff", "pct_change"], default: "lag" },
    { key: "periods", label: "Periods", type: "number", default: 1 },
    { key: "group_by", label: "Group by", type: "string_list" },
    { key: "order_by", label: "Order by", type: "string_list" },
    { key: "output_column", label: "Output column", type: "string" },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? "").trim();
    const operation = String(config.operation ?? "lag").trim();
    const periods = Math.max(1, Math.floor(Number(config.periods ?? 1)));
    const groupBy = strList(config.group_by);
    const orderBy = strList(config.order_by ?? config.sort_by);
    const outCol = String(config.output_column ?? `${column}_${operation}`).trim();
    if (!table || !column) {
      return { warnings: ["multi_row_formula: table and column required"], python: [] };
    }
    const lines = [
      `# \u2500\u2500 multi_row_formula: ${table}.${column} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`)
    ];
    if (orderBy.length) {
      lines.push(`    _df = _df.sort_values(by=[${orderBy.map((c) => JSON.stringify(c)).join(", ")}])`);
    }
    const colPy = JSON.stringify(column);
    const groupPy = groupBy.length ? `[${groupBy.map((c) => JSON.stringify(c)).join(", ")}]` : null;
    if (groupPy) {
      if (operation === "diff") {
        lines.push(`    _df[${JSON.stringify(outCol)}] = _df.groupby(${groupPy})[${colPy}].diff(periods=${periods})`);
      } else if (operation === "pct_change") {
        lines.push(`    _df[${JSON.stringify(outCol)}] = _df.groupby(${groupPy})[${colPy}].pct_change(periods=${periods})`);
      } else if (operation === "lead") {
        lines.push(`    _df[${JSON.stringify(outCol)}] = _df.groupby(${groupPy})[${colPy}].shift(-${periods})`);
      } else {
        lines.push(`    _df[${JSON.stringify(outCol)}] = _df.groupby(${groupPy})[${colPy}].shift(${periods})`);
      }
    } else if (operation === "diff") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df[${colPy}].diff(periods=${periods})`);
    } else if (operation === "pct_change") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df[${colPy}].pct_change(periods=${periods})`);
    } else if (operation === "lead") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df[${colPy}].shift(-${periods})`);
    } else {
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df[${colPy}].shift(${periods})`);
    }
    lines.push(...pandasWriteTable(output, "multi_row_formula"), "except Exception as _e:", '    print(f"[multi_row_formula] failed: {_e}")', "    raise");
    return { python: lines };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/multi_row_formula.ts
function compile(config) {
  return multiRowFormulaComponent.compile(config);
}
export {
  compile
};
