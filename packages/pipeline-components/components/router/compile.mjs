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
  description: "Split rows into multiple output tables by condition.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "routes",
      label: "Routes",
      description: 'JSON array [{"condition":"status == \\"active\\"","output_table":"active_rows"}]',
      type: "text",
      required: true
    },
    { key: "default_output_table", label: "Default output table", type: "string" }
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
        return { warnings: ["router: routes must be valid JSON array"], python: [] };
      }
    } else if (Array.isArray(raw)) {
      routes = raw;
    }
    if (!table || !routes.length) {
      return { warnings: ["router: table and routes required"], python: [] };
    }
    const lines = [
      `# \u2500\u2500 router: ${table} \u2500\u2500`,
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
      lines.push(`    _subset.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`);
      lines.push(`    print(f"[router] wrote {len(_subset)} rows to ${escapePyString(out)}")`);
    }
    if (defaultOut) {
      const { outSchema, outName } = outputParts(defaultOut);
      lines.push("    _default = _df[~_df.index.isin(_routed_idx)]");
      lines.push(`    _default.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`);
      lines.push(`    print(f"[router] wrote {len(_default)} default rows to ${escapePyString(defaultOut)}")`);
    }
    lines.push("except Exception as _e:", '    print(f"[router] failed: {_e}")', "    raise");
    return { python: lines };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/router.ts
function compile(config) {
  return routerComponent.compile(config);
}
export {
  compile
};
