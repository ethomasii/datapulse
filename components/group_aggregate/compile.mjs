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

// web/lib/elt/native-components/definitions/_sql-helpers.ts
function sqlQualifiedTable(table) {
  const parts = table.split(".").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return table;
  return parts.map((p) => `"${p.replace(/"/g, '""')}"`).join(".");
}
function sqlCreateTableAs(output, selectSql) {
  return `CREATE OR REPLACE TABLE ${sqlQualifiedTable(output)} AS
${selectSql}`;
}
function isDataframeExecution(config) {
  const mode = String(config.execution ?? config.transform_mode ?? "warehouse").toLowerCase();
  return mode === "dataframe" || mode === "pandas" || mode === "worker";
}
function sqlAggExpr(column, fn) {
  const col = `"${column.replace(/"/g, '""')}"`;
  switch (fn.toLowerCase()) {
    case "sum":
      return `SUM(${col})`;
    case "count":
      return `COUNT(${col})`;
    case "avg":
    case "mean":
      return `AVG(${col})`;
    case "min":
      return `MIN(${col})`;
    case "max":
      return `MAX(${col})`;
    case "count_distinct":
    case "nunique":
      return `COUNT(DISTINCT ${col})`;
    default:
      return `${fn.toUpperCase()}(${col})`;
  }
}

// web/lib/elt/native-components/definitions/table-ops.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var groupAggregateComponent = {
  id: "group_aggregate",
  aliases: ["aggregate_table", "group_by", "summarize", "make_group", "customer_metrics"],
  name: "Group & aggregate",
  category: "transformation",
  description: "Group by columns and aggregate in warehouse SQL (default) or dataframe groupby.",
  compileTarget: "warehouse",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "group_by", label: "Group by columns", type: "string_list", required: true },
    {
      key: "aggregations",
      label: "Aggregations JSON",
      description: 'e.g. {"amount":"sum","id":"count"}',
      type: "text",
      required: true
    },
    { key: "output_table", label: "Output table", type: "string", required: true },
    {
      key: "execution",
      label: "Execution",
      type: "select",
      options: ["warehouse", "dataframe"],
      default: "warehouse"
    }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const groupBy = strList(config.group_by ?? config.groupby);
    let aggs = {};
    const raw = config.aggregations ?? config.agg;
    if (typeof raw === "string") {
      try {
        aggs = JSON.parse(raw);
      } catch {
        return { warnings: ["group_aggregate: aggregations must be valid JSON"], sql: [], python: [] };
      }
    } else if (raw && typeof raw === "object") {
      aggs = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]));
    }
    if (!table || !output || !groupBy.length || !Object.keys(aggs).length) {
      return { warnings: ["group_aggregate: table, group_by, aggregations, output_table required"], sql: [], python: [] };
    }
    if (isDataframeExecution(config)) {
      const { outSchema, outName } = outputParts(output);
      const groupPy = `[${groupBy.map((c) => JSON.stringify(c)).join(", ")}]`;
      const aggPy = JSON.stringify(aggs);
      const python = [
        `# \u2500\u2500 group_aggregate (dataframe): ${table} \u2192 ${output} \u2500\u2500`,
        "try:",
        ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
        `    _df = _df.groupby(${groupPy}, as_index=False).agg(${aggPy})`,
        `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
        `    print(f"[group_aggregate] wrote {len(_df)} rows to ${escapePyString(output)}")`,
        "except Exception as _grp_err:",
        '    print(f"[group_aggregate] failed: {_grp_err}")',
        "    raise"
      ];
      return { python };
    }
    const groupCols = groupBy.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
    const aggCols = Object.entries(aggs).map(([col, fn]) => `${sqlAggExpr(col, fn)} AS "${col.replace(/"/g, '""')}_agg"`).join(",\n  ");
    const src = sqlQualifiedTable(table);
    const sql = [
      sqlCreateTableAs(
        output,
        `SELECT
  ${groupCols},
  ${aggCols}
FROM ${src}
GROUP BY ${groupCols}`
      )
    ];
    return { sql };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/group_aggregate.ts
function compile(config) {
  return groupAggregateComponent.compile(config);
}
export {
  compile
};
