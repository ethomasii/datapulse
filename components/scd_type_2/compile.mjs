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
var scdType2Component = {
  id: "scd_type_2",
  aliases: ["slowly_changing_dimension_2", "historized_dimension"],
  name: "SCD Type 2",
  category: "transformation",
  description: "Historize dimension changes with effective dates and current-row flag.",
  compileTarget: "python",
  fields: [
    { key: "staging_table", label: "Staging table", type: "string", required: true },
    { key: "dimension_table", label: "Dimension table", type: "string", required: true },
    { key: "business_keys", label: "Business keys", type: "string_list", required: true },
    { key: "compare_columns", label: "Columns to detect change", type: "string_list" },
    { key: "effective_from_column", label: "Effective from column", type: "string", default: "effective_from" },
    { key: "effective_to_column", label: "Effective to column", type: "string", default: "effective_to" },
    { key: "is_current_column", label: "Is current column", type: "string", default: "is_current" },
    { key: "output_table", label: "Output dimension table", type: "string" }
  ],
  compile(config) {
    const staging = String(config.staging_table ?? config.table ?? "").trim();
    const dimension = String(config.dimension_table ?? config.target_table ?? "").trim();
    const output = outputTable(config, dimension);
    const keys = strList(config.business_keys ?? config.natural_key);
    const compareCols = strList(config.compare_columns ?? config.tracked_columns);
    const effFrom = String(config.effective_from_column ?? "effective_from").trim();
    const effTo = String(config.effective_to_column ?? "effective_to").trim();
    const isCurrent = String(config.is_current_column ?? "is_current").trim();
    if (!staging || !dimension || !keys.length) {
      return { warnings: ["scd_type_2: staging_table, dimension_table, business_keys required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const keysPy = `[${keys.map((k) => JSON.stringify(k)).join(", ")}]`;
    const comparePy = compareCols.length ? `[${compareCols.map((c) => JSON.stringify(c)).join(", ")}]` : `[c for c in _staging.columns if c not in ${keysPy} + [${JSON.stringify(effFrom)}, ${JSON.stringify(effTo)}, ${JSON.stringify(isCurrent)}]]`;
    const python = [
      `# \u2500\u2500 scd_type_2: ${staging} \u2192 ${output} \u2500\u2500`,
      "import pandas as pd",
      "from datetime import datetime, timezone",
      "try:",
      "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
      "    _sql = _dest_client.sql_client()",
      `    _staging = pd.read_sql('SELECT * FROM ${escapePyString(staging)}', _sql._engine)`,
      `    try:`,
      `        _dim = pd.read_sql('SELECT * FROM ${escapePyString(dimension)}', _sql._engine)`,
      "    except Exception:",
      "        _dim = pd.DataFrame(columns=list(_staging.columns) + [])",
      `    _keys = ${keysPy}`,
      `    _compare = ${comparePy}`,
      `    _eff_from = ${JSON.stringify(effFrom)}`,
      `    _eff_to = ${JSON.stringify(effTo)}`,
      `    _is_cur = ${JSON.stringify(isCurrent)}`,
      "    _now = datetime.now(timezone.utc).isoformat()",
      "    _far = '9999-12-31T23:59:59+00:00'",
      "    if _eff_from not in _staging.columns: _staging[_eff_from] = _now",
      "    if _eff_to not in _staging.columns: _staging[_eff_to] = _far",
      "    if _is_cur not in _staging.columns: _staging[_is_cur] = True",
      "    if len(_dim) == 0:",
      "        _df = _staging.copy()",
      "    else:",
      "        _cur = _dim[_dim[_is_cur] == True] if _is_cur in _dim.columns else _dim",
      "        _merged = _staging.merge(_cur, on=_keys, how='left', suffixes=('', '_cur'), indicator=True)",
      "        _changed = _merged[_merged['_merge'] == 'both']",
      "        _diff_mask = pd.Series(False, index=_changed.index)",
      "        for _c in _compare:",
      "            if _c in _changed.columns and f'{_c}_cur' in _changed.columns:",
      "                _diff_mask = _diff_mask | (_changed[_c].astype(str) != _changed[f'{_c}_cur'].astype(str))",
      "        _changed = _changed[_diff_mask]",
      "        if len(_changed):",
      "            _expire_keys = _changed[_keys].drop_duplicates()",
      "            _dim = _dim.merge(_expire_keys.assign(_expire=True), on=_keys, how='left')",
      "            _dim.loc[(_dim['_expire'] == True) & (_dim[_is_cur] == True), _eff_to] = _now",
      "            _dim.loc[(_dim['_expire'] == True) & (_dim[_is_cur] == True), _is_cur] = False",
      "            _dim = _dim.drop(columns=['_expire'], errors='ignore')",
      "            _new = _changed[_staging.columns].copy()",
      "            _new[_eff_from] = _now",
      "            _new[_eff_to] = _far",
      "            _new[_is_cur] = True",
      "            _df = pd.concat([_dim, _new], ignore_index=True)",
      "        else:",
      "            _new_only = _merged[_merged['_merge'] == 'left_only'][_staging.columns]",
      "            _df = pd.concat([_dim, _new_only], ignore_index=True) if len(_new_only) else _dim",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[scd_type_2] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[scd_type_2] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/scd_type_2.ts
function compile(config) {
  return scdType2Component.compile(config);
}
export {
  compile
};
