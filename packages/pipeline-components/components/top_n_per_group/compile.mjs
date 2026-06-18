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

// web/lib/elt/native-components/definitions/more-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var topNPerGroupComponent = {
  id: "top_n_per_group",
  name: "Top N per group",
  category: "transformation",
  description: "Keep top N rows per group after sorting.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "group_by", label: "Group by", type: "string_list", required: true },
    { key: "sort_column", label: "Sort column", type: "string", required: true },
    { key: "n", label: "N per group", type: "number", default: 1 },
    { key: "ascending", label: "Ascending sort", type: "boolean", default: false },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const groupBy = strList(config.group_by ?? config.groupby);
    const sortCol = String(config.sort_column ?? config.column ?? "").trim();
    const n = Math.max(1, Math.floor(Number(config.n ?? 1)));
    const ascending = config.ascending === true;
    if (!table || !output || !groupBy.length || !sortCol) {
      return { warnings: ["top_n_per_group: table, group_by, sort_column, output_table required"], python: [] };
    }
    const groupPy = `[${groupBy.map((c) => JSON.stringify(c)).join(", ")}]`;
    const ascPy = ascending ? "True" : "False";
    const { outSchema, outName } = outputParts(output);
    const python = [
      `# \u2500\u2500 top_n_per_group: ${table} \u2192 ${output} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df = _df.sort_values(by=${JSON.stringify(sortCol)}, ascending=${ascPy})`,
      `    _df = _df.groupby(${groupPy}, as_index=False, group_keys=False).head(${n})`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[top_n_per_group] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[top_n_per_group] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/top_n_per_group.ts
function compile(config) {
  return topNPerGroupComponent.compile(config);
}
export {
  compile
};
