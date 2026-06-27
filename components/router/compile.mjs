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

// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function pandasReadTable(table) {
  return [
    "import pandas as pd",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`
  ];
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
function pandasQueryToSqlWhere(expr) {
  const s = expr.trim();
  if (!s) return s;
  if (/\s=\s/.test(s) && !/==/.test(s)) return s;
  return s.replace(/\s+and\s+/gi, " AND ").replace(/\s+or\s+/gi, " OR ").replace(/==/g, " = ").replace(/!=/g, " <> ").replace(/\s+in\s+\(/gi, " IN (").trim();
}

// web/lib/elt/native-components/definitions/advanced-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var routerComponent = {
  id: "router",
  aliases: ["conditional_split", "branch"],
  name: "Router",
  category: "transformation",
  description: "Split rows into multiple output tables by condition (warehouse SQL CTAS by default; one CTAS per route).",
  compileTarget: "warehouse",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "routes",
      label: "Routes",
      description: 'JSON array of branches. Each object needs "condition" (SQL WHERE / pandas query) and "output_table" (schema.table). Rows can match multiple routes.',
      type: "text",
      required: true,
      default: "[]",
      placeholder: '[\n  {"condition":"status = \\"active\\"","output_table":"staging.active"},\n  {"condition":"status = \\"inactive\\"","output_table":"staging.inactive"}\n]'
    },
    {
      key: "default_output_table",
      label: "Default output table",
      description: "Optional table for rows that match no route condition.",
      type: "string"
    },
    {
      key: "execution",
      label: "Execution",
      description: "warehouse = SQL CTAS per route (default); dataframe = worker pandas",
      type: "select",
      options: ["warehouse", "dataframe"],
      default: "warehouse"
    }
  ],
  compile(config) {
    const table = inputTable(config);
    const defaultOut = String(config.default_output_table ?? config.default_table ?? "").trim();
    let routes = [];
    const raw = config.routes ?? config.outputs;
    if (typeof raw === "string") {
      try {
        routes = JSON.parse(raw);
      } catch {
        return { warnings: ["router: routes must be valid JSON array"], sql: [], python: [] };
      }
    } else if (Array.isArray(raw)) {
      routes = raw;
    }
    if (!table || !routes.length) {
      return { warnings: ["router: table and routes required"], sql: [], python: [] };
    }
    if (isDataframeExecution(config)) {
      const lines = [
        `# \u2500\u2500 router (dataframe): ${table} \u2500\u2500`,
        "try:",
        ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
        "    _routed_idx = set()"
      ];
      for (const route of routes) {
        const cond = String(route.condition ?? "").trim();
        const out = String(route.output_table ?? route.table ?? "").trim();
        if (!cond || !out) continue;
        const { outSchema, outName } = outputParts(out);
        lines.push(`    _subset = _df[_df.eval(${JSON.stringify(cond)})]`);
        lines.push("    _routed_idx.update(_subset.index.tolist())");
        lines.push(
          `    _subset.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`
        );
        lines.push(`    print(f"[router] wrote {len(_subset)} rows to ${escapePyString(out)}")`);
      }
      if (defaultOut) {
        const { outSchema, outName } = outputParts(defaultOut);
        lines.push("    _default = _df[~_df.index.isin(_routed_idx)]");
        lines.push(
          `    _default.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`
        );
        lines.push(`    print(f"[router] wrote {len(_default)} default rows to ${escapePyString(defaultOut)}")`);
      }
      lines.push("except Exception as _e:", '    print(f"[router] failed: {_e}")', "    raise");
      return { python: lines };
    }
    const src = sqlQualifiedTable(table);
    const sql = [];
    const routedConditions = [];
    for (const route of routes) {
      const cond = String(route.condition ?? "").trim();
      const out = String(route.output_table ?? route.table ?? "").trim();
      if (!cond || !out) continue;
      const where = pandasQueryToSqlWhere(cond);
      routedConditions.push(`(${where})`);
      sql.push(sqlCreateTableAs(out, `SELECT *
FROM ${src}
WHERE ${where}`));
    }
    if (defaultOut) {
      const where = routedConditions.length > 0 ? `NOT (${routedConditions.join(" OR ")})` : "1 = 1";
      sql.push(sqlCreateTableAs(defaultOut, `SELECT *
FROM ${src}
WHERE ${where}`));
    }
    if (!sql.length) {
      return { warnings: ["router: each route needs condition and output_table"], sql: [] };
    }
    return { sql };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/router.ts
function compile(config) {
  return routerComponent.compile(config);
}
export {
  compile
};
