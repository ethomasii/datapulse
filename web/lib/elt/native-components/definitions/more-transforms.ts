import { escapePyString } from "@/lib/elt/escape-py";
import type { NativeComponentDefinition } from "../types";
import { inputTable, outputTable } from "./_config-helpers";
import { pandasReadTable, pandasWriteTable, strList } from "./_pandas-helpers";

function outputParts(output: string) {
  const outSchema = output.includes(".") ? output.split(".")[0]! : "public";
  const outName = output.includes(".") ? output.split(".").pop()! : output;
  return { outSchema, outName };
}

export const unpivotComponent: NativeComponentDefinition = {
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
    { key: "output_table", label: "Output table", type: "string", required: true },
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
    const valueKw = valueVars.length
      ? `value_vars=[${valueVars.map((c) => JSON.stringify(c)).join(", ")}], `
      : "";
    const python = [
      `# ── unpivot: ${table} → ${output} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df.melt(id_vars=${idPy}, ${valueKw}var_name=${JSON.stringify(varName)}, value_name=${JSON.stringify(valueName)})`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[unpivot] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[unpivot] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const rankComponent: NativeComponentDefinition = {
  id: "rank",
  name: "Rank rows",
  category: "transformation",
  description: "Rank rows by column with optional grouping (pandas rank).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Rank column", type: "string", required: true },
    { key: "group_by", label: "Group by", type: "string_list" },
    { key: "method", label: "Tie method", type: "select", options: ["average", "min", "max", "first", "dense"], default: "average" },
    { key: "ascending", label: "Ascending", type: "boolean", default: true },
    { key: "output_column", label: "Output column name", type: "string", default: "rank" },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? "").trim();
    const groupBy = strList(config.group_by ?? config.groupby);
    const method = String(config.method ?? "average").trim();
    const ascending = config.ascending !== false;
    const outCol = String(config.output_column ?? "rank").trim();
    if (!table || !column) {
      return { warnings: ["rank: table and column required"], python: [] };
    }
    const ascPy = ascending ? "True" : "False";
    const rankExpr =
      groupBy.length > 0
        ? `_df.groupby([${groupBy.map((c) => JSON.stringify(c)).join(", ")}])[${JSON.stringify(column)}].rank(method=${JSON.stringify(method)}, ascending=${ascPy})`
        : `_df[${JSON.stringify(column)}].rank(method=${JSON.stringify(method)}, ascending=${ascPy})`;
    const python = [
      `# ── rank: ${table} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df[${JSON.stringify(outCol)}] = ${rankExpr}`,
      ...pandasWriteTable(output, "rank"),
      "except Exception as _e:",
      '    print(f"[rank] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const runningTotalComponent: NativeComponentDefinition = {
  id: "running_total",
  aliases: ["cumulative_sum", "cumsum"],
  name: "Running total",
  category: "transformation",
  description: "Cumulative sum of a column, optionally per group.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Value column", type: "string", required: true },
    { key: "group_by", label: "Group by", type: "string_list" },
    { key: "sort_by", label: "Sort before cumsum", type: "string_list" },
    { key: "output_column", label: "Output column", type: "string", default: "running_total" },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.value_column ?? "").trim();
    const groupBy = strList(config.group_by);
    const sortBy = strList(config.sort_by ?? config.order_by);
    const outCol = String(config.output_column ?? "running_total").trim();
    if (!table || !column) {
      return { warnings: ["running_total: table and column required"], python: [] };
    }
    const lines = [
      `# ── running_total: ${table} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
    ];
    if (sortBy.length) {
      lines.push(`    _df = _df.sort_values(by=[${sortBy.map((c) => JSON.stringify(c)).join(", ")}])`);
    }
    if (groupBy.length) {
      lines.push(
        `    _df[${JSON.stringify(outCol)}] = _df.groupby([${groupBy.map((c) => JSON.stringify(c)).join(", ")}])[${JSON.stringify(column)}].cumsum()`
      );
    } else {
      lines.push(`    _df[${JSON.stringify(outCol)}] = _df[${JSON.stringify(column)}].cumsum()`);
    }
    lines.push(...pandasWriteTable(output, "running_total"), "except Exception as _e:", '    print(f"[running_total] failed: {_e}")', "    raise");
    return { python: lines };
  },
};

export const recordIdComponent: NativeComponentDefinition = {
  id: "record_id",
  aliases: ["row_number", "surrogate_key"],
  name: "Record ID",
  category: "transformation",
  description: "Add monotonic row ID column.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "ID column name", type: "string", default: "record_id" },
    { key: "start_at", label: "Start at", type: "number", default: 1 },
    { key: "group_by", label: "Restart per group", type: "string_list" },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.output_column ?? "record_id").trim();
    const startAt = Math.floor(Number(config.start_at ?? 1));
    const groupBy = strList(config.group_by);
    if (!table) return { warnings: ["record_id: table required"], python: [] };
    const lines = [
      `# ── record_id: ${table} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
    ];
    if (groupBy.length) {
      lines.push(
        `    _df[${JSON.stringify(column)}] = _df.groupby([${groupBy.map((c) => JSON.stringify(c)).join(", ")}]).cumcount() + ${startAt}`
      );
    } else {
      lines.push(`    _df[${JSON.stringify(column)}] = range(${startAt}, ${startAt} + len(_df))`);
    }
    lines.push(...pandasWriteTable(output, "record_id"), "except Exception as _e:", '    print(f"[record_id] failed: {_e}")', "    raise");
    return { python: lines };
  },
};

export const textToColumnsComponent: NativeComponentDefinition = {
  id: "text_to_columns",
  aliases: ["split_column", "parse_text"],
  name: "Text to columns",
  category: "transformation",
  description: "Split a string column into multiple columns.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Source column", type: "string", required: true },
    { key: "delimiter", label: "Delimiter", type: "string", default: "," },
    { key: "output_columns", label: "Output column names", type: "string_list" },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? "").trim();
    const delimiter = String(config.delimiter ?? config.sep ?? ",").trim();
    const outCols = strList(config.output_columns ?? config.new_columns);
    if (!table || !column) {
      return { warnings: ["text_to_columns: table and column required"], python: [] };
    }
    const lines = [
      `# ── text_to_columns: ${table}.${column} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _split = _df[${JSON.stringify(column)}].astype(str).str.split(${JSON.stringify(delimiter)}, expand=True)`,
    ];
    if (outCols.length) {
      for (let i = 0; i < outCols.length; i++) {
        lines.push(`    _df[${JSON.stringify(outCols[i]!)}] = _split[${i}]`);
      }
    } else {
      lines.push("    _df = _df.join(_split.add_prefix(f'{column}_'))");
    }
    lines.push(...pandasWriteTable(output, "text_to_columns"), "except Exception as _e:", '    print(f"[text_to_columns] failed: {_e}")', "    raise");
    return { python: lines };
  },
};

export const jsonFlattenComponent: NativeComponentDefinition = {
  id: "json_flatten",
  aliases: ["json_path_extractor", "dataframe_flatten_nested_columns"],
  name: "JSON flatten",
  category: "transformation",
  description: "Flatten JSON object column into separate columns.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "JSON column", type: "string", required: true },
    { key: "drop_source", label: "Drop source column", type: "boolean", default: true },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.json_column ?? "").trim();
    const dropSource = config.drop_source !== false;
    if (!table || !column) {
      return { warnings: ["json_flatten: table and column required"], python: [] };
    }
    const lines = [
      `# ── json_flatten: ${table}.${column} ──`,
      "import json",
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _parsed = _df[${JSON.stringify(column)}].apply(lambda x: json.loads(x) if isinstance(x, str) else (x if isinstance(x, dict) else {}))`,
      "    _flat = pd.json_normalize(_parsed)",
      "    _flat.columns = [str(c).replace('.', '_') for c in _flat.columns]",
      `    _df = _df.drop(columns=[${JSON.stringify(column)}]) if ${dropSource ? "True" : "False"} else _df`,
      "    _df = pd.concat([_df.reset_index(drop=True), _flat.reset_index(drop=True)], axis=1)",
      ...pandasWriteTable(output, "json_flatten"),
      "except Exception as _e:",
      '    print(f"[json_flatten] failed: {_e}")',
      "    raise",
    ];
    return { python: lines };
  },
};

export const oneHotEncodingComponent: NativeComponentDefinition = {
  id: "one_hot_encoding",
  aliases: ["get_dummies", "dummy_encode"],
  name: "One-hot encoding",
  category: "transformation",
  description: "One-hot encode categorical columns (pandas get_dummies).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "columns", label: "Columns to encode", type: "string_list", required: true },
    { key: "drop_first", label: "Drop first category", type: "boolean", default: false },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const columns = strList(config.columns ?? config.categorical_columns);
    const dropFirst = config.drop_first === true;
    if (!table || !output || !columns.length) {
      return { warnings: ["one_hot_encoding: table, columns, output_table required"], python: [] };
    }
    const colsPy = `[${columns.map((c) => JSON.stringify(c)).join(", ")}]`;
    const { outSchema, outName } = outputParts(output);
    const python = [
      `# ── one_hot_encoding: ${table} → ${output} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _dummies = pd.get_dummies(_df[${colsPy}], drop_first=${dropFirst ? "True" : "False"})`,
      `    _df = pd.concat([_df.drop(columns=${colsPy}, errors='ignore'), _dummies], axis=1)`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[one_hot_encoding] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[one_hot_encoding] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const trainTestSplitComponent: NativeComponentDefinition = {
  id: "train_test_split",
  aliases: ["train_test_splitter"],
  name: "Train/test split",
  category: "transformation",
  description: "Split table into train and test sets.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "test_size", label: "Test fraction (0–1)", type: "number", default: 0.2 },
    { key: "random_state", label: "Random seed", type: "number" },
    { key: "output_train", label: "Train output table", type: "string", required: true },
    { key: "output_test", label: "Test output table", type: "string", required: true },
  ],
  compile(config) {
    const table = inputTable(config);
    const testSize = Number(config.test_size ?? 0.2);
    const seed = config.random_state != null ? Math.floor(Number(config.random_state)) : null;
    const trainOut = String(config.output_train ?? config.train_table ?? "").trim();
    const testOut = String(config.output_test ?? "").trim();
    if (!table || !trainOut || !testOut) {
      return { warnings: ["train_test_split: table, output_train, output_test required"], python: [] };
    }
    const trainParts = outputParts(trainOut);
    const testParts = outputParts(testOut);
    const seedKw = seed != null ? `, random_state=${seed}` : "";
    const python = [
      `# ── train_test_split: ${table} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _test = _df.sample(frac=${testSize}${seedKw})`,
      "    _train = _df.drop(_test.index)",
      `    _train.to_sql("${escapePyString(trainParts.outName)}", _sql._engine, schema="${escapePyString(trainParts.outSchema)}", if_exists="replace", index=False)`,
      `    _test.to_sql("${escapePyString(testParts.outName)}", _sql._engine, schema="${escapePyString(testParts.outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[train_test_split] train={len(_train)} test={len(_test)}")`,
      "except Exception as _e:",
      '    print(f"[train_test_split] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const topNPerGroupComponent: NativeComponentDefinition = {
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
    { key: "output_table", label: "Output table", type: "string", required: true },
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
      `# ── top_n_per_group: ${table} → ${output} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df.sort_values(by=${JSON.stringify(sortCol)}, ascending=${ascPy})`,
      `    _df = _df.groupby(${groupPy}, as_index=False, group_keys=False).head(${n})`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[top_n_per_group] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[top_n_per_group] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const countRecordsComponent: NativeComponentDefinition = {
  id: "count_records",
  aliases: ["row_count", "aggregate_count"],
  name: "Count records",
  category: "transformation",
  description: "Count rows, optionally grouped.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "group_by", label: "Group by", type: "string_list" },
    { key: "output_column", label: "Count column name", type: "string", default: "row_count" },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const groupBy = strList(config.group_by ?? config.groupby);
    const outCol = String(config.output_column ?? "row_count").trim();
    if (!table || !output) {
      return { warnings: ["count_records: table and output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const aggLine = groupBy.length
      ? `_df = _df.groupby([${groupBy.map((c) => JSON.stringify(c)).join(", ")}], as_index=False).size().rename(columns={0: ${JSON.stringify(outCol)}})`
      : `_df = pd.DataFrame({${JSON.stringify(outCol)}: [len(_df)]})`;
    const python = [
      `# ── count_records: ${table} → ${output} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    ${aggLine}`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[count_records] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[count_records] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const auditColumnsComponent: NativeComponentDefinition = {
  id: "audit_columns",
  aliases: ["audit_columns_transform"],
  name: "Audit columns",
  category: "transformation",
  description: "Add created_at / updated_at / source metadata columns.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "add_created_at", label: "Add created_at", type: "boolean", default: true },
    { key: "add_updated_at", label: "Add updated_at", type: "boolean", default: true },
    { key: "source_label", label: "Source label column value", type: "string" },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const addCreated = config.add_created_at !== false;
    const addUpdated = config.add_updated_at !== false;
    const sourceLabel = String(config.source_label ?? config.source ?? "").trim();
    if (!table) return { warnings: ["audit_columns: table required"], python: [] };
    const lines = [
      `# ── audit_columns: ${table} ──`,
      "from datetime import datetime, timezone",
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      "    _now = datetime.now(timezone.utc).isoformat()",
    ];
    if (addCreated) lines.push("    _df['created_at'] = _now");
    if (addUpdated) lines.push("    _df['updated_at'] = _now");
    if (sourceLabel) lines.push(`    _df['source'] = ${JSON.stringify(sourceLabel)}`);
    lines.push(...pandasWriteTable(output, "audit_columns"), "except Exception as _e:", '    print(f"[audit_columns] failed: {_e}")', "    raise");
    return { python: lines };
  },
};

export const semiJoinComponent: NativeComponentDefinition = {
  id: "semi_join",
  aliases: ["exists_join"],
  name: "Semi join",
  category: "transformation",
  description: "Rows in left that have a match in right (left columns only).",
  compileTarget: "python",
  fields: [
    { key: "left_table", label: "Left table", type: "string", required: true },
    { key: "right_table", label: "Right table", type: "string", required: true },
    { key: "on", label: "Join key(s)", type: "string_list", required: true },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const left = String(config.left_table ?? config.left_asset_key ?? "").trim();
    const right = String(config.right_table ?? config.right_asset_key ?? "").trim();
    const output = outputTable(config);
    const on = strList(config.on ?? config.join_keys);
    if (!left || !right || !output || !on.length) {
      return { warnings: ["semi_join: left_table, right_table, on, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const onPy = `[${on.map((c) => JSON.stringify(c)).join(", ")}]`;
    const python = [
      `# ── semi_join: ${left} ∩ ${right} ──`,
      "import pandas as pd",
      "try:",
      "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
      "    _sql = _dest_client.sql_client()",
      `    _left = pd.read_sql('SELECT * FROM ${escapePyString(left)}', _sql._engine)`,
      `    _right = pd.read_sql('SELECT * FROM ${escapePyString(right)}', _sql._engine)`,
      `    _df = _left.merge(_right[${onPy}].drop_duplicates(), on=${onPy}, how='inner')`,
      `    _df = _df[_left.columns]`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[semi_join] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[semi_join] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};
