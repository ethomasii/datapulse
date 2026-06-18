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
var unpivotComponent = {
  id: "unpivot",
  aliases: ["melt", "pivot_long"],
  name: "Unpivot / melt",
  category: "transformation",
  description: "Unpivot wide data to long format (pandas melt).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "id_vars", label: "ID columns (keep)", type: "string_list", required: true },
    { key: "value_vars", label: "Columns to unpivot", type: "string_list" },
    { key: "var_name", label: "Variable column name", type: "string", default: "variable" },
    { key: "value_name", label: "Value column name", type: "string", default: "value" },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const idVars = strList(config.id_vars ?? config.index);
    const valueVars = strList(config.value_vars ?? config.columns);
    const varName = String(config.var_name ?? "variable").trim();
    const valueName = String(config.value_name ?? "value").trim();
    if (!table || !output || !idVars.length) {
      return { warnings: ["unpivot: table, id_vars, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const idPy = `[${idVars.map((c) => JSON.stringify(c)).join(", ")}]`;
    const valueKw = valueVars.length ? `value_vars=[${valueVars.map((c) => JSON.stringify(c)).join(", ")}], ` : "";
    const python = [
      `# \u2500\u2500 unpivot: ${table} \u2192 ${output} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df = _df.melt(id_vars=${idPy}, ${valueKw}var_name=${JSON.stringify(varName)}, value_name=${JSON.stringify(valueName)})`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[unpivot] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[unpivot] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/unpivot.ts
function compile(config) {
  return unpivotComponent.compile(config);
}
export {
  compile
};
