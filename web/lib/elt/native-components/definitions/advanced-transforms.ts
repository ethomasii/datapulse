import { escapePyString } from "@/lib/elt/escape-py";
import type { NativeComponentDefinition } from "../types";
import { inputTable, outputTable } from "./_config-helpers";
import { pandasReadTable, pandasWriteTable, strList } from "./_pandas-helpers";

function outputParts(output: string) {
  const outSchema = output.includes(".") ? output.split(".")[0]! : "public";
  const outName = output.includes(".") ? output.split(".").pop()! : output;
  return { outSchema, outName };
}

function parseJsonObject(raw: unknown, label: string): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

export const hashComponent: NativeComponentDefinition = {
  id: "hash",
  aliases: ["column_hash", "checksum"],
  name: "Hash columns",
  category: "transformation",
  description: "Compute MD5/SHA-1/SHA-256 hash of one or more columns.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "columns", label: "Columns to hash", type: "string_list" },
    { key: "algorithm", label: "Algorithm", type: "select", options: ["md5", "sha1", "sha256"], default: "sha256" },
    { key: "output_column", label: "Output column", type: "string", default: "hash" },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const columns = strList(config.columns ?? config.hash_columns);
    const algorithm = String(config.algorithm ?? "sha256").trim().toLowerCase();
    const outCol = String(config.output_column ?? "hash").trim();
    if (!table) return { warnings: ["hash: table required"], python: [] };
    const colsPy = columns.length ? `[${columns.map((c) => JSON.stringify(c)).join(", ")}]` : "list(_df.columns)";
    const lines = [
      `# ── hash: ${table} ──`,
      "import hashlib",
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _algo = ${JSON.stringify(algorithm)}`,
      `    _cols = ${colsPy}`,
      "    def _row_hash(_row):",
      "        _s = '|'.join(str(_row[c]) for c in _cols)",
      "        _b = _s.encode('utf-8')",
      "        if _algo == 'md5': return hashlib.md5(_b).hexdigest()",
      "        if _algo == 'sha1': return hashlib.sha1(_b).hexdigest()",
      "        return hashlib.sha256(_b).hexdigest()",
      `    _df[${JSON.stringify(outCol)}] = _df[_cols].apply(_row_hash, axis=1)`,
      ...pandasWriteTable(output, "hash"),
      "except Exception as _e:",
      '    print(f"[hash] failed: {_e}")',
      "    raise",
    ];
    return { python: lines };
  },
};

export const transposeComponent: NativeComponentDefinition = {
  id: "transpose",
  name: "Transpose",
  category: "transformation",
  description: "Transpose rows and columns (pandas transpose).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "index_column", label: "New index column name", type: "string", default: "field" },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const indexCol = String(config.index_column ?? "field").trim();
    if (!table || !output) {
      return { warnings: ["transpose: table and output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const python = [
      `# ── transpose: ${table} → ${output} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df.T.reset_index().rename(columns={'index': ${JSON.stringify(indexCol)}})`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[transpose] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[transpose] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const arrayExploderComponent: NativeComponentDefinition = {
  id: "array_exploder",
  aliases: ["explode_array", "unnest"],
  name: "Array exploder",
  category: "transformation",
  description: "Expand an array column so each element becomes its own row.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Array column", type: "string", required: true },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const column = String(config.column ?? config.array_column ?? "").trim();
    if (!table || !output || !column) {
      return { warnings: ["array_exploder: table, column, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const python = [
      `# ── array_exploder: ${table}.${column} ──`,
      "import json",
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _col = ${JSON.stringify(column)}`,
      "    def _to_list(_v):",
      "        if isinstance(_v, list): return _v",
      "        if isinstance(_v, str):",
      "            try: return json.loads(_v)",
      "            except Exception: return [_v]",
      "        return [_v]",
      "    _df[_col] = _df[_col].apply(_to_list)",
      "    _df = _df.explode(_col, ignore_index=True)",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[array_exploder] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[array_exploder] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const alterRowComponent: NativeComponentDefinition = {
  id: "alter_row",
  aliases: ["cdc_marker", "change_type"],
  name: "Alter row (CDC)",
  category: "transformation",
  description: "Tag rows with CDC operation (insert/update/delete) based on conditions.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "delete_condition", label: "Delete condition", type: "string", description: "pandas query, e.g. status == 'deleted'" },
    { key: "update_condition", label: "Update condition", type: "string" },
    { key: "output_column", label: "Change type column", type: "string", default: "_change_type" },
    { key: "default_operation", label: "Default operation", type: "select", options: ["insert", "update", "upsert"], default: "insert" },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const deleteCond = String(config.delete_condition ?? "").trim();
    const updateCond = String(config.update_condition ?? "").trim();
    const outCol = String(config.output_column ?? "_change_type").trim();
    const defaultOp = String(config.default_operation ?? "insert").trim();
    if (!table) return { warnings: ["alter_row: table required"], python: [] };
    const lines = [
      `# ── alter_row: ${table} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df[${JSON.stringify(outCol)}] = ${JSON.stringify(defaultOp)}`,
    ];
    if (updateCond) {
      lines.push(`    _df.loc[_df.eval(${JSON.stringify(updateCond)}), ${JSON.stringify(outCol)}] = 'update'`);
    }
    if (deleteCond) {
      lines.push(`    _df.loc[_df.eval(${JSON.stringify(deleteCond)}), ${JSON.stringify(outCol)}] = 'delete'`);
    }
    lines.push(...pandasWriteTable(output, "alter_row"), "except Exception as _e:", '    print(f"[alter_row] failed: {_e}")', "    raise");
    return { python: lines };
  },
};

export const appendFieldsComponent: NativeComponentDefinition = {
  id: "append_fields",
  aliases: ["broadcast_join", "lookup_append"],
  name: "Append fields",
  category: "transformation",
  description: "Broadcast-append columns from a small lookup table to every row.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Main table", type: "string", required: true },
    { key: "lookup_table", label: "Lookup table", type: "string", required: true },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = inputTable(config);
    const lookup = String(config.lookup_table ?? config.source_table ?? "").trim();
    const output = outputTable(config);
    if (!table || !lookup || !output) {
      return { warnings: ["append_fields: table, lookup_table, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const python = [
      `# ── append_fields: ${table} + ${lookup} ──`,
      "import pandas as pd",
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _lookup = pd.read_sql('SELECT * FROM ${escapePyString(lookup)}', _sql._engine)`,
      "    _lookup['_append_key'] = 1",
      "    _df['_append_key'] = 1",
      "    _df = _df.merge(_lookup, on='_append_key').drop(columns=['_append_key'])",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[append_fields] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[append_fields] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const nestedFieldExtractorComponent: NativeComponentDefinition = {
  id: "nested_field_extractor",
  aliases: ["json_path_extractor", "dot_path_extractor"],
  name: "Nested field extractor",
  category: "transformation",
  description: "Extract dot-path fields from JSON/dict columns into flat columns.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Nested column", type: "string", required: true },
    {
      key: "paths",
      label: "Path mapping",
      description: 'JSON object path → column, e.g. {"user.email":"email"}',
      type: "text",
      required: true,
    },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.nested_column ?? "").trim();
    const paths = parseJsonObject(config.paths ?? config.field_paths ?? config.mapping, "paths");
    if (!table || !column || !paths || !Object.keys(paths).length) {
      return { warnings: ["nested_field_extractor: table, column, paths required"], python: [] };
    }
    const lines = [
      `# ── nested_field_extractor: ${table}.${column} ──`,
      "import json",
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _src_col = ${JSON.stringify(column)}`,
      "    def _get_path(_obj, _path):",
      "        _cur = _obj",
      "        for _p in _path.split('.'):",
      "            if not isinstance(_cur, dict) or _p not in _cur: return None",
      "            _cur = _cur[_p]",
      "        return _cur",
      "    def _parse_cell(_v):",
      "        if isinstance(_v, dict): return _v",
      "        if isinstance(_v, str):",
      "            try: return json.loads(_v)",
      "            except Exception: return {}",
      "        return {}",
    ];
    for (const [path, outName] of Object.entries(paths)) {
      lines.push(
        `    _df[${JSON.stringify(String(outName))}] = _df[_src_col].apply(lambda x: _get_path(_parse_cell(x), ${JSON.stringify(path)}))`
      );
    }
    lines.push(...pandasWriteTable(output, "nested_field_extractor"), "except Exception as _e:", '    print(f"[nested_field_extractor] failed: {_e}")', "    raise");
    return { python: lines };
  },
};

export const multiRowFormulaComponent: NativeComponentDefinition = {
  id: "multi_row_formula",
  aliases: ["lag_lead", "shift_formula"],
  name: "Multi-row formula",
  category: "transformation",
  description: "Lag, lead, or diff a column with optional grouping and ordering.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Source column", type: "string", required: true },
    { key: "operation", label: "Operation", type: "select", options: ["lag", "lead", "diff", "pct_change"], default: "lag" },
    { key: "periods", label: "Periods", type: "number", default: 1 },
    { key: "group_by", label: "Group by", type: "string_list" },
    { key: "order_by", label: "Order by", type: "string_list" },
    { key: "output_column", label: "Output column", type: "string" },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? "").trim();
    const operation = String(config.operation ?? "lag").trim();
    const periods = Math.max(1, Math.floor(Number(config.periods ?? 1)));
    const groupBy = strList(config.group_by);
    const orderBy = strList(config.order_by ?? config.sort_by);
    const outCol = String(config.output_column ?? `${column}_${operation}`).trim();
    if (!table || !column) {
      return { warnings: ["multi_row_formula: table and column required"], python: [] };
    }
    const lines = [
      `# ── multi_row_formula: ${table}.${column} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
    ];
    if (orderBy.length) {
      lines.push(`    _df = _df.sort_values(by=[${orderBy.map((c) => JSON.stringify(c)).join(", ")}])`);
    }
    const colPy = JSON.stringify(column);
    const groupPy = groupBy.length ? `[${groupBy.map((c) => JSON.stringify(c)).join(", ")}]` : null;
    if (groupPy) {
      if (operation === "diff") {
        lines.push(`    _df[${JSON.stringify(outCol)}] = _df.groupby(${groupPy})[${colPy}].diff(periods=${periods})`);
      } else if (operation === "pct_change") {
        lines.push(`    _df[${JSON.stringify(outCol)}] = _df.groupby(${groupPy})[${colPy}].pct_change(periods=${periods})`);
      } else if (operation === "lead") {
        lines.push(`    _df[${JSON.stringify(outCol)}] = _df.groupby(${groupPy})[${colPy}].shift(-${periods})`);
      } else {
        lines.push(`    _df[${JSON.stringify(outCol)}] = _df.groupby(${groupPy})[${colPy}].shift(${periods})`);
      }
    } else if (operation === "diff") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df[${colPy}].diff(periods=${periods})`);
    } else if (operation === "pct_change") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df[${colPy}].pct_change(periods=${periods})`);
    } else if (operation === "lead") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df[${colPy}].shift(-${periods})`);
    } else {
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df[${colPy}].shift(${periods})`);
    }
    lines.push(...pandasWriteTable(output, "multi_row_formula"), "except Exception as _e:", '    print(f"[multi_row_formula] failed: {_e}")', "    raise");
    return { python: lines };
  },
};

export const windowCalculationComponent: NativeComponentDefinition = {
  id: "window_calculation",
  aliases: ["window_function", "analytic_function"],
  name: "Window calculation",
  category: "transformation",
  description: "Window functions: lag, lead, rank, row_number, cumsum, rolling mean.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Value column", type: "string", required: true },
    {
      key: "function",
      label: "Function",
      type: "select",
      options: ["lag", "lead", "rank", "dense_rank", "row_number", "cumsum", "rolling_mean"],
      default: "lag",
    },
    { key: "partition_by", label: "Partition by", type: "string_list" },
    { key: "order_by", label: "Order by", type: "string_list" },
    { key: "periods", label: "Lag/lead periods", type: "number", default: 1 },
    { key: "window", label: "Rolling window size", type: "number", default: 3 },
    { key: "output_column", label: "Output column", type: "string" },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.value_column ?? "").trim();
    const fn = String(config.function ?? config.window_function ?? "lag").trim();
    const partitionBy = strList(config.partition_by ?? config.group_by);
    const orderBy = strList(config.order_by ?? config.sort_by);
    const periods = Math.max(1, Math.floor(Number(config.periods ?? 1)));
    const window = Math.max(1, Math.floor(Number(config.window ?? 3)));
    const outCol = String(config.output_column ?? `${column}_${fn}`).trim();
    if (!table || !column) {
      return { warnings: ["window_calculation: table and column required"], python: [] };
    }
    const lines = [
      `# ── window_calculation: ${table}.${column} (${fn}) ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
    ];
    if (orderBy.length) {
      lines.push(`    _df = _df.sort_values(by=[${orderBy.map((c) => JSON.stringify(c)).join(", ")}])`);
    }
    const colPy = JSON.stringify(column);
    const partPy = partitionBy.length ? `[${partitionBy.map((c) => JSON.stringify(c)).join(", ")}]` : null;
    const grouped = partPy ? `_df.groupby(${partPy}, group_keys=False)` : "_df";
    if (fn === "rank") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = ${grouped}[${colPy}].rank(method='average')`);
    } else if (fn === "dense_rank") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = ${grouped}[${colPy}].rank(method='dense')`);
    } else if (fn === "row_number") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = ${grouped}.cumcount() + 1`);
    } else if (fn === "cumsum") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = ${grouped}[${colPy}].cumsum()`);
    } else if (fn === "rolling_mean") {
      lines.push(
        `    _df[${JSON.stringify(outCol)}] = ${grouped}[${colPy}].transform(lambda s: s.rolling(${window}, min_periods=1).mean())`
      );
    } else if (fn === "lead") {
      lines.push(`    _df[${JSON.stringify(outCol)}] = ${grouped}[${colPy}].shift(-${periods})`);
    } else {
      lines.push(`    _df[${JSON.stringify(outCol)}] = ${grouped}[${colPy}].shift(${periods})`);
    }
    lines.push(...pandasWriteTable(output, "window_calculation"), "except Exception as _e:", '    print(f"[window_calculation] failed: {_e}")', "    raise");
    return { python: lines };
  },
};

export const outlierClipperComponent: NativeComponentDefinition = {
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
    { key: "output_table", label: "Output table", type: "string" },
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
      `# ── outlier_clipper: ${table} ──`,
      "import numpy as np",
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
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
      "    raise",
    ];
    return { python: lines };
  },
};

export const pctChangeComponent: NativeComponentDefinition = {
  id: "pct_change",
  aliases: ["period_over_period", "growth_rate"],
  name: "Percent change",
  category: "transformation",
  description: "Period-over-period diff and percent change on a value column.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Value column", type: "string", required: true },
    { key: "group_by", label: "Group by", type: "string_list" },
    { key: "order_by", label: "Order by", type: "string_list", required: true },
    { key: "periods", label: "Periods", type: "number", default: 1 },
    { key: "output_column", label: "Output column", type: "string", default: "pct_change" },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.value_column ?? "").trim();
    const groupBy = strList(config.group_by);
    const orderBy = strList(config.order_by ?? config.time_column);
    const periods = Math.max(1, Math.floor(Number(config.periods ?? 1)));
    const outCol = String(config.output_column ?? "pct_change").trim();
    if (!table || !column || !orderBy.length) {
      return { warnings: ["pct_change: table, column, order_by required"], python: [] };
    }
    const lines = [
      `# ── pct_change: ${table}.${column} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df.sort_values(by=[${orderBy.map((c) => JSON.stringify(c)).join(", ")}])`,
    ];
    const colPy = JSON.stringify(column);
    if (groupBy.length) {
      const groupPy = `[${groupBy.map((c) => JSON.stringify(c)).join(", ")}]`;
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df.groupby(${groupPy})[${colPy}].pct_change(periods=${periods})`);
    } else {
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df[${colPy}].pct_change(periods=${periods})`);
    }
    lines.push(...pandasWriteTable(output, "pct_change"), "except Exception as _e:", '    print(f"[pct_change] failed: {_e}")', "    raise");
    return { python: lines };
  },
};

export const weightedAverageComponent: NativeComponentDefinition = {
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
    { key: "output_table", label: "Output table", type: "string", required: true },
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
    const aggLine = groupBy.length
      ? `_df['_wp'] = _df[${colPy}] * _df[${weightPy}]; _df = (_df.groupby([${groupBy.map((c) => JSON.stringify(c)).join(", ")}])['_wp'].sum() / _df.groupby([${groupBy.map((c) => JSON.stringify(c)).join(", ")}])[${weightPy}].sum()).reset_index(name=${JSON.stringify(outCol)})`
      : `_df = pd.DataFrame({${JSON.stringify(outCol)}: [(_df[${colPy}] * _df[${weightPy}]).sum() / _df[${weightPy}].sum()]})`;
    const python = [
      `# ── weighted_average: ${table} → ${output} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    ${aggLine}`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[weighted_average] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[weighted_average] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const routerComponent: NativeComponentDefinition = {
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
      description: 'JSON array [{\"condition\":\"status == \\"active\\"\",\"output_table\":\"active_rows\"}]',
      type: "text",
      required: true,
    },
    { key: "default_output_table", label: "Default output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const defaultOut = String(config.default_output_table ?? config.default_table ?? "").trim();
    let routes: Array<{ condition?: string; output_table?: string; table?: string }> = [];
    const raw = config.routes ?? config.outputs;
    if (typeof raw === "string") {
      try {
        routes = JSON.parse(raw) as typeof routes;
      } catch {
        return { warnings: ["router: routes must be valid JSON array"], python: [] };
      }
    } else if (Array.isArray(raw)) {
      routes = raw as typeof routes;
    }
    if (!table || !routes.length) {
      return { warnings: ["router: table and routes required"], python: [] };
    }
    const lines = [
      `# ── router: ${table} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      "    _routed_idx = set()",
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
  },
};

export const dataMaskingComponent: NativeComponentDefinition = {
  id: "data_masking",
  aliases: ["pii_masking", "anonymize"],
  name: "Data masking",
  category: "transformation",
  description: "Rule-based PII masking: hash, partial mask, or full redact per column.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "policies",
      label: "Column policies",
      description: 'JSON e.g. {"email":{"method":"hash"},"ssn":{"method":"partial","visible":4}}',
      type: "text",
      required: true,
    },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const policies = parseJsonObject(config.policies ?? config.masking_rules, "policies");
    if (!table || !policies || !Object.keys(policies).length) {
      return { warnings: ["data_masking: table and policies required"], python: [] };
    }
    const lines = [
      `# ── data_masking: ${table} ──`,
      "import hashlib",
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _policies = ${JSON.stringify(policies)}`,
      "    for _col, _rule in _policies.items():",
      "        if _col not in _df.columns: continue",
      "        _method = str((_rule or {}).get('method', 'redact')).lower()",
      "        if _method == 'hash':",
      "            _df[_col] = _df[_col].astype(str).apply(lambda s: hashlib.sha256(s.encode()).hexdigest()[:16])",
      "        elif _method == 'partial':",
      "            _vis = int((_rule or {}).get('visible', 4))",
      "            _df[_col] = _df[_col].astype(str).apply(lambda s: '*' * max(0, len(s) - _vis) + s[-_vis:] if s else s)",
      "        else:",
      "            _df[_col] = '***REDACTED***'",
      ...pandasWriteTable(output, "data_masking"),
      "except Exception as _e:",
      '    print(f"[data_masking] failed: {_e}")',
      "    raise",
    ];
    return { python: lines };
  },
};

export const schemaValidatorComponent: NativeComponentDefinition = {
  id: "schema_validator",
  aliases: ["json_schema_validator"],
  name: "Schema validator",
  category: "transformation",
  description: "Validate JSON rows against a JSON Schema; drop, tag, or raise on failure.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "JSON column", type: "string", required: true },
    { key: "json_schema", label: "JSON Schema", type: "text", required: true },
    { key: "on_failure", label: "On failure", type: "select", options: ["drop", "tag", "raise"], default: "drop" },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const column = String(config.column ?? config.json_column ?? "").trim();
    const schemaRaw = String(config.json_schema ?? config.schema ?? "").trim();
    const onFailure = String(config.on_failure ?? "drop").trim();
    if (!table || !output || !column || !schemaRaw) {
      return { warnings: ["schema_validator: table, column, json_schema, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const python = [
      `# ── schema_validator: ${table}.${column} ──`,
      "import json",
      "try:",
      "    import jsonschema",
      "except ImportError:",
      "    jsonschema = None",
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _schema = json.loads(${JSON.stringify(schemaRaw)})`,
      `    _col = ${JSON.stringify(column)}`,
      `    _on_fail = ${JSON.stringify(onFailure)}`,
      "    if jsonschema is None:",
      '        raise ImportError("jsonschema package required for schema_validator")',
      "    def _valid(_v):",
      "        try:",
      "            _obj = json.loads(_v) if isinstance(_v, str) else _v",
      "            jsonschema.validate(_obj, _schema)",
      "            return True",
      "        except Exception:",
      "            return False",
      "    _mask = _df[_col].apply(_valid)",
      "    if _on_fail == 'raise' and not _mask.all():",
      '        raise ValueError("schema validation failed for one or more rows")',
      "    if _on_fail == 'tag':",
      "        _df['_schema_valid'] = _mask",
      "    elif _on_fail == 'drop':",
      "        _df = _df[_mask]",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[schema_validator] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[schema_validator] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const xmlParserComponent: NativeComponentDefinition = {
  id: "xml_parser",
  name: "XML parser",
  category: "transformation",
  description: "Parse XML in a column into flat fields using path mappings.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "XML column", type: "string", required: true },
    {
      key: "paths",
      label: "XPath mappings",
      description: 'JSON object xpath → column, e.g. {".//name":"patient_name"}',
      type: "text",
      required: true,
    },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const column = String(config.column ?? config.xml_column ?? "").trim();
    const paths = parseJsonObject(config.paths ?? config.xpath_mappings, "paths");
    if (!table || !output || !column || !paths || !Object.keys(paths).length) {
      return { warnings: ["xml_parser: table, column, paths, output_table required"], python: [] };
    }
    const { outSchema, outName: tableName } = outputParts(output);
    const python = [
      `# ── xml_parser: ${table}.${column} ──`,
      "import xml.etree.ElementTree as ET",
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _col = ${JSON.stringify(column)}`,
      `    _paths = ${JSON.stringify(paths)}`,
      "    def _extract(_xml, _path):",
      "        try:",
      "            _root = ET.fromstring(_xml if isinstance(_xml, str) else str(_xml))",
      "            _tag = _path.lstrip('./').split('/')[-1]",
      "            _el = _root.find('.//' + _tag)",
      "            return _el.text if _el is not None else None",
      "        except Exception:",
      "            return None",
    ];
    for (const [path, colName] of Object.entries(paths)) {
      python.push(
        `    _df[${JSON.stringify(String(colName))}] = _df[_col].apply(lambda x: _extract(x, ${JSON.stringify(path)}))`
      );
    }
    python.push(
      `    _df.to_sql("${escapePyString(tableName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[xml_parser] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[xml_parser] failed: {_e}")',
      "    raise"
    );
    return { python };
  },
};
