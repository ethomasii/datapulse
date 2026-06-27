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

// web/lib/elt/native-components/definitions/advanced-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var weightedAverageComponent = {
  id: "weighted_average",
  aliases: ["weighted_mean"],
  name: "Weighted average",
  category: "transformation",
  description: "Compute weighted average of a column, optionally grouped.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Value column", type: "string", required: true },
    { key: "weight_column", label: "Weight column", type: "string", required: true },
    { key: "group_by", label: "Group by", type: "string_list" },
    { key: "output_column", label: "Output column", type: "string", default: "weighted_avg" },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const column = String(config.column ?? config.value_column ?? "").trim();
    const weightCol = String(config.weight_column ?? config.weight ?? "").trim();
    const groupBy = strList(config.group_by);
    const outCol = String(config.output_column ?? "weighted_avg").trim();
    if (!table || !output || !column || !weightCol) {
      return { warnings: ["weighted_average: table, column, weight_column, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const colPy = JSON.stringify(column);
    const weightPy = JSON.stringify(weightCol);
    const aggLine = groupBy.length ? `_df['_wp'] = _df[${colPy}] * _df[${weightPy}]; _df = (_df.groupby([${groupBy.map((c) => JSON.stringify(c)).join(", ")}])['_wp'].sum() / _df.groupby([${groupBy.map((c) => JSON.stringify(c)).join(", ")}])[${weightPy}].sum()).reset_index(name=${JSON.stringify(outCol)})` : `_df = pd.DataFrame({${JSON.stringify(outCol)}: [(_df[${colPy}] * _df[${weightPy}]).sum() / _df[${weightPy}].sum()]})`;
    const python = [
      `# \u2500\u2500 weighted_average: ${table} \u2192 ${output} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    ${aggLine}`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[weighted_average] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[weighted_average] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/weighted_average.ts
function compile(config) {
  return weightedAverageComponent.compile(config);
}
export {
  compile
};
