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

// web/lib/elt/native-components/definitions/table-ops.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var groupAggregateComponent = {
  id: "group_aggregate",
  aliases: ["aggregate_table", "group_by"],
  name: "Group & aggregate",
  category: "transformation",
  description: "Group by columns and compute aggregations (pandas groupby).",
  compileTarget: "python",
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
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? "").trim();
    const groupBy = strList(config.group_by ?? config.groupby);
    let aggs = {};
    const raw = config.aggregations ?? config.agg;
    if (typeof raw === "string") {
      try {
        aggs = JSON.parse(raw);
      } catch {
        return { warnings: ["group_aggregate: aggregations must be valid JSON"], python: [] };
      }
    } else if (raw && typeof raw === "object") {
      aggs = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]));
    }
    if (!table || !output || !groupBy.length || !Object.keys(aggs).length) {
      return { warnings: ["group_aggregate: table, group_by, aggregations, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const groupPy = `[${groupBy.map((c) => JSON.stringify(c)).join(", ")}]`;
    const aggPy = JSON.stringify(aggs);
    const python = [
      `# \u2500\u2500 group_aggregate: ${table} \u2192 ${output} \u2500\u2500`,
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
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-ywkMkX/group_aggregate.ts
function compile(config) {
  return groupAggregateComponent.compile(config);
}
export {
  compile
};
