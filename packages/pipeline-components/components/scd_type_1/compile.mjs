// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// web/lib/elt/native-components/definitions/_config-helpers.ts
function outputTable(config, fallback = "") {
  return String(config.output_table ?? config.asset_name ?? fallback).trim();
}

// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function strList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// web/lib/elt/native-components/definitions/scd-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var scdType1Component = {
  id: "scd_type_1",
  aliases: ["slowly_changing_dimension_1", "dimension_merge"],
  name: "SCD Type 1",
  category: "transformation",
  description: "Merge staging into dimension \u2014 overwrite attributes on business key match, insert new keys.",
  compileTarget: "python",
  fields: [
    { key: "staging_table", label: "Staging table", type: "string", required: true },
    { key: "dimension_table", label: "Dimension table", type: "string", required: true },
    { key: "business_keys", label: "Business keys", type: "string_list", required: true },
    { key: "update_columns", label: "Columns to update", type: "string_list" },
    { key: "output_table", label: "Output dimension table", type: "string" }
  ],
  compile(config) {
    const staging = String(config.staging_table ?? config.table ?? "").trim();
    const dimension = String(config.dimension_table ?? config.target_table ?? "").trim();
    const output = outputTable(config, dimension);
    const keys = strList(config.business_keys ?? config.natural_key);
    const updateCols = strList(config.update_columns ?? config.attributes);
    if (!staging || !dimension || !keys.length) {
      return { warnings: ["scd_type_1: staging_table, dimension_table, business_keys required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const keysPy = `[${keys.map((k) => JSON.stringify(k)).join(", ")}]`;
    const updatePy = updateCols.length ? `[${updateCols.map((c) => JSON.stringify(c)).join(", ")}]` : `[c for c in _staging.columns if c not in ${keysPy}]`;
    const python = [
      `# \u2500\u2500 scd_type_1: ${staging} \u2192 ${output} \u2500\u2500`,
      "import pandas as pd",
      "try:",
      "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
      "    _sql = _dest_client.sql_client()",
      `    _staging = pd.read_sql('SELECT * FROM ${escapePyString(staging)}', _sql._engine)`,
      `    try:`,
      `        _dim = pd.read_sql('SELECT * FROM ${escapePyString(dimension)}', _sql._engine)`,
      "    except Exception:",
      "        _dim = pd.DataFrame(columns=_staging.columns)",
      `    _keys = ${keysPy}`,
      `    _update_cols = ${updatePy}`,
      "    _dim = _dim.set_index(_keys)",
      "    _staging_idx = _staging.set_index(_keys)",
      "    _dim.update(_staging_idx[_update_cols])",
      "    _new_keys = _staging_idx.index.difference(_dim.index)",
      "    if len(_new_keys):",
      "        _dim = pd.concat([_dim, _staging_idx.loc[_new_keys]])",
      "    _df = _dim.reset_index()",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[scd_type_1] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[scd_type_1] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/scd_type_1.ts
function compile(config) {
  return scdType1Component.compile(config);
}
export {
  compile
};
