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
function parseTableParts(table) {
  const parts = table.split(".");
  if (parts.length > 1) {
    return { schema: parts[0], name: parts.slice(1).join(".") };
  }
  return { schema: "public", name: table };
}
function pandasReadTable(table) {
  return [
    "import pandas as pd",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`
  ];
}
function pandasWriteTable(outputTable2, label) {
  const { schema, name } = parseTableParts(outputTable2);
  return [
    `    _df.to_sql("${escapePyString(name)}", _sql._engine, schema="${escapePyString(schema)}", if_exists="replace", index=False)`,
    `    print(f"[${label}] wrote {len(_df)} rows to ${escapePyString(outputTable2)}")`
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
var outlierClipperComponent = {
  id: "outlier_clipper",
  aliases: ["outlier_detection", "winsorize"],
  name: "Outlier clipper",
  category: "transformation",
  description: "Detect and clip, drop, or flag outliers using IQR or z-score.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "columns", label: "Numeric columns", type: "string_list", required: true },
    { key: "method", label: "Method", type: "select", options: ["iqr", "zscore"], default: "iqr" },
    { key: "action", label: "Action", type: "select", options: ["clip", "drop", "flag"], default: "clip" },
    { key: "threshold", label: "Z-score threshold", type: "number", default: 3 },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const columns = strList(config.columns ?? config.numeric_columns);
    const method = String(config.method ?? "iqr").trim();
    const action = String(config.action ?? "clip").trim();
    const threshold = Number(config.threshold ?? 3);
    if (!table || !columns.length) {
      return { warnings: ["outlier_clipper: table and columns required"], python: [] };
    }
    const colsPy = `[${columns.map((c) => JSON.stringify(c)).join(", ")}]`;
    const lines = [
      `# \u2500\u2500 outlier_clipper: ${table} \u2500\u2500`,
      "import numpy as np",
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _cols = ${colsPy}`,
      `    _method = ${JSON.stringify(method)}`,
      `    _action = ${JSON.stringify(action)}`,
      "    _mask = pd.Series(False, index=_df.index)",
      "    for _c in _cols:",
      "        _s = pd.to_numeric(_df[_c], errors='coerce')",
      "        if _method == 'zscore':",
      `            _z = (_s - _s.mean()) / (_s.std() or 1)`,
      `            _out = _z.abs() > ${threshold}`,
      "        else:",
      "            _q1, _q3 = _s.quantile(0.25), _s.quantile(0.75)",
      "            _iqr = _q3 - _q1",
      "            _out = (_s < _q1 - 1.5 * _iqr) | (_s > _q3 + 1.5 * _iqr)",
      "        if _action == 'clip':",
      "            if _method == 'zscore':",
      `                _lo, _hi = _s.mean() - ${threshold} * (_s.std() or 0), _s.mean() + ${threshold} * (_s.std() or 0)`,
      "                _df[_c] = _s.clip(_lo, _hi)",
      "            else:",
      "                _df[_c] = _s.clip(_q1 - 1.5 * _iqr, _q3 + 1.5 * _iqr)",
      "        _mask = _mask | _out.fillna(False)",
      "    if _action == 'flag':",
      "        _df['_is_outlier'] = _mask",
      "    elif _action == 'drop':",
      "        _df = _df[~_mask]",
      ...pandasWriteTable(output, "outlier_clipper"),
      "except Exception as _e:",
      '    print(f"[outlier_clipper] failed: {_e}")',
      "    raise"
    ];
    return { python: lines };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/outlier_clipper.ts
function compile(config) {
  return outlierClipperComponent.compile(config);
}
export {
  compile
};
