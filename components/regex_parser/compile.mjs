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

// web/lib/elt/native-components/definitions/domain-parsers.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var DAGSTER_ONLY = [
  "group_name",
  "partition_type",
  "partition_start",
  "partition_date_column",
  "partition_values",
  "owners",
  "asset_tags",
  "kinds",
  "freshness_max_lag_minutes",
  "freshness_cron",
  "include_preview_metadata",
  "preview_rows",
  "deps",
  "retry_policy_max_retries",
  "retry_policy_delay_seconds",
  "retry_policy_backoff",
  "dynamic_partition_name",
  "partition_dimensions"
];
var regexParserComponent = {
  id: "regex_parser",
  name: "Regex parser",
  category: "transformation",
  description: "Extract, match, replace, or split text with regular expressions.",
  compileTarget: "python",
  dagsterOnlyFields: DAGSTER_ONLY,
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Column", type: "string", required: true },
    { key: "pattern", label: "Regex pattern", type: "text", required: true },
    {
      key: "mode",
      label: "Mode",
      type: "select",
      options: ["extract", "match", "replace", "split"],
      default: "extract"
    },
    { key: "replacement", label: "Replacement (replace mode)", type: "string" },
    { key: "output_columns", label: "Output column names", type: "string_list" },
    { key: "output_column", label: "Output column (match/replace)", type: "string" },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? "").trim();
    const pattern = String(config.pattern ?? "").trim();
    const mode = String(config.mode ?? "extract").trim();
    const replacement = String(config.replacement ?? "");
    const outCols = strList(config.output_columns);
    const outCol = String(config.output_column ?? column).trim();
    if (!table || !column || !pattern) {
      return { warnings: ["regex_parser: table, column, pattern required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const outColsPy = outCols.length ? JSON.stringify(outCols) : "None";
    const python = [
      `# \u2500\u2500 regex_parser: ${table}.${column} (${mode}) \u2500\u2500`,
      "import re",
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _col = ${JSON.stringify(column)}`,
      `    _pat = ${JSON.stringify(pattern)}`,
      `    _mode = ${JSON.stringify(mode)}`,
      `    _repl = ${JSON.stringify(replacement)}`,
      `    _out_col = ${JSON.stringify(outCol)}`,
      `    _out_cols = ${outColsPy}`,
      "    if _col not in _df.columns:",
      `        raise ValueError(f"column {_col!r} not in table")`,
      "    _src = _df[_col].astype(str) if _df[_col].dtype != 'object' else _df[_col]",
      "    if _mode == 'extract':",
      "        _xpat = _pat",
      "        try:",
      "            if re.compile(_pat).groups == 0:",
      "                _xpat = f'({_pat})'",
      "        except re.error:",
      "            pass",
      "        _extracted = _src.str.extract(_xpat)",
      "        if _out_cols:",
      "            _extracted.columns = _out_cols[:len(_extracted.columns)]",
      "        else:",
      "            _extracted.columns = [f'{_col}_extracted_{i}' for i in range(len(_extracted.columns))]",
      "        _df = pd.concat([_df, _extracted], axis=1)",
      "    elif _mode == 'match':",
      "        _df[_out_col] = _src.str.match(_pat)",
      "    elif _mode == 'replace':",
      "        _df[_out_col] = _src.str.replace(_pat, _repl, regex=True)",
      "    elif _mode == 'split':",
      "        _df = _df.assign(**{_col: _src.str.split(_pat)}).explode(_col).reset_index(drop=True)",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[regex_parser] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[regex_parser] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/regex_parser.ts
function compile(config) {
  return regexParserComponent.compile(config);
}
export {
  compile
};
