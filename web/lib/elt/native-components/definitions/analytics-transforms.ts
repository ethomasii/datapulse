import { escapePyString } from "@/lib/elt/escape-py";
import type { NativeComponentDefinition } from "../types";
import { pandasReadTable, pandasWriteTable, strList } from "./_pandas-helpers";
import {
  sqlCreateTableAs,
  sqlJoinOnClause,
  sqlQualifiedTable,
  useDataframeExecution,
} from "./_sql-helpers";

function outputParts(output: string) {
  const outSchema = output.includes(".") ? output.split(".")[0]! : "public";
  const outName = output.includes(".") ? output.split(".").pop()! : output;
  return { outSchema, outName };
}

export const pivotComponent: NativeComponentDefinition = {
  id: "pivot",
  aliases: ["pivot_table", "pivot_transform", "cross_tab"],
  name: "Pivot table",
  category: "transformation",
  description: "Pivot long data to wide format (pandas pivot_table).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "index", label: "Index columns", type: "string_list", required: true },
    { key: "columns", label: "Pivot column", type: "string", required: true },
    { key: "values", label: "Values column", type: "string", required: true },
    { key: "aggfunc", label: "Aggregation", type: "select", options: ["sum", "mean", "count", "min", "max"], default: "sum" },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? "").trim();
    const index = strList(config.index ?? config.index_cols);
    const columns = String(config.columns ?? config.pivot_column ?? "").trim();
    const values = String(config.values ?? config.value_column ?? "").trim();
    const aggfunc = String(config.aggfunc ?? "sum").trim();
    if (!table || !output || !index.length || !columns || !values) {
      return { warnings: ["pivot: table, index, columns, values, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const indexPy = `[${index.map((c) => JSON.stringify(c)).join(", ")}]`;
    const python = [
      `# ── pivot: ${table} → ${output} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df.pivot_table(index=${indexPy}, columns=${JSON.stringify(columns)}, values=${JSON.stringify(values)}, aggfunc="${escapePyString(aggfunc)}").reset_index()`,
      `    _df.columns = [str(c) for c in _df.columns]`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[pivot] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[pivot] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const crossJoinComponent: NativeComponentDefinition = {
  id: "cross_join",
  aliases: ["cartesian_join"],
  name: "Cross join",
  category: "transformation",
  description: "Cartesian product of two tables.",
  compileTarget: "python",
  fields: [
    { key: "left_table", label: "Left table", type: "string", required: true },
    { key: "right_table", label: "Right table", type: "string", required: true },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const left = String(config.left_table ?? "").trim();
    const right = String(config.right_table ?? "").trim();
    const output = String(config.output_table ?? "").trim();
    if (!left || !right || !output) {
      return { warnings: ["cross_join: left_table, right_table, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const python = [
      `# ── cross_join: ${left} × ${right} ──`,
      "import pandas as pd",
      "try:",
      "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
      "    _sql = _dest_client.sql_client()",
      `    _left = pd.read_sql('SELECT * FROM ${escapePyString(left)}', _sql._engine)`,
      `    _right = pd.read_sql('SELECT * FROM ${escapePyString(right)}', _sql._engine)`,
      "    _left['_cross_key'] = 1",
      "    _right['_cross_key'] = 1",
      "    _df = _left.merge(_right, on='_cross_key').drop(columns=['_cross_key'])",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[cross_join] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[cross_join] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const antiJoinComponent: NativeComponentDefinition = {
  id: "anti_join",
  aliases: ["except_join", "left_anti_join", "orphan_rows"],
  name: "Anti join",
  category: "transformation",
  description: "Rows in left table not in right — warehouse SQL anti-join (default) or dataframe.",
  compileTarget: "dbt",
  fields: [
    { key: "left_table", label: "Left table", type: "string", required: true },
    { key: "right_table", label: "Right table", type: "string", required: true },
    { key: "on", label: "Join key(s)", type: "string_list", required: true },
    { key: "output_table", label: "Output table", type: "string", required: true },
    {
      key: "execution",
      label: "Execution",
      type: "select",
      options: ["warehouse", "dataframe"],
      default: "warehouse",
    },
  ],
  compile(config) {
    const left = String(config.left_table ?? "").trim();
    const right = String(config.right_table ?? "").trim();
    const output = String(config.output_table ?? "").trim();
    const on = strList(config.on ?? config.join_keys);
    if (!left || !right || !output || !on.length) {
      return { warnings: ["anti_join: left_table, right_table, on, output_table required"], sql: [], python: [] };
    }

    if (useDataframeExecution(config)) {
      const { outSchema, outName } = outputParts(output);
      const onPy = `[${on.map((c) => JSON.stringify(c)).join(", ")}]`;
      const python = [
        `# ── anti_join (dataframe): ${left} − ${right} ──`,
        "import pandas as pd",
        "try:",
        "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
        "    _sql = _dest_client.sql_client()",
        `    _left = pd.read_sql('SELECT * FROM ${escapePyString(left)}', _sql._engine)`,
        `    _right = pd.read_sql('SELECT * FROM ${escapePyString(right)}', _sql._engine)`,
        `    _df = _left.merge(_right[${onPy}], on=${onPy}, how='left', indicator=True)`,
        "    _df = _df[_df['_merge'] == 'left_only'].drop(columns=['_merge'])",
        `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
        `    print(f"[anti_join] wrote {len(_df)} rows to ${escapePyString(output)}")`,
        "except Exception as _e:",
        '    print(f"[anti_join] failed: {_e}")',
        "    raise",
      ];
      return { python };
    }

    const leftQ = sqlQualifiedTable(left);
    const rightQ = sqlQualifiedTable(right);
    const onClause = sqlJoinOnClause(on, [], []);
    const nullCheck = on.map((c) => `r."${c.replace(/"/g, '""')}" IS NULL`).join(" AND ");
    const sql = [
      sqlCreateTableAs(
        output,
        `SELECT l.*\nFROM ${leftQ} AS l\nLEFT JOIN ${rightQ} AS r\n  ON ${onClause}\nWHERE ${nullCheck}`
      ),
    ];
    return { sql };
  },
};

export const dataCleansingComponent: NativeComponentDefinition = {
  id: "data_cleansing",
  aliases: ["clean_data", "data_cleaning"],
  name: "Data cleansing",
  category: "transformation",
  description: "Trim strings, optional lowercase, drop all-null rows.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "string_columns", label: "String columns to trim", type: "string_list" },
    { key: "lowercase_columns", label: "Columns to lowercase", type: "string_list" },
    { key: "drop_null_rows", label: "Drop rows where all values null", type: "boolean", default: true },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    const trimCols = strList(config.string_columns ?? config.trim_columns);
    const lowerCols = strList(config.lowercase_columns);
    const dropNull = config.drop_null_rows !== false;
    if (!table) return { warnings: ["data_cleansing: table required"], python: [] };
    const { outSchema, outName } = outputParts(output);
    const lines = [
      `# ── data_cleansing: ${table} → ${output} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
    ];
    for (const col of trimCols) {
      lines.push(`    if ${JSON.stringify(col)} in _df.columns:`);
      lines.push(`        _df[${JSON.stringify(col)}] = _df[${JSON.stringify(col)}].astype(str).str.strip()`);
    }
    for (const col of lowerCols) {
      lines.push(`    if ${JSON.stringify(col)} in _df.columns:`);
      lines.push(`        _df[${JSON.stringify(col)}] = _df[${JSON.stringify(col)}].astype(str).str.lower()`);
    }
    if (dropNull) lines.push("    _df = _df.dropna(how='all')");
    lines.push(
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[data_cleansing] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[data_cleansing] failed: {_e}")',
      "    raise"
    );
    return { python: lines };
  },
};

export const datetimeParserComponent: NativeComponentDefinition = {
  id: "datetime_parser",
  aliases: ["parse_dates", "date_parser"],
  name: "Parse datetime columns",
  category: "transformation",
  description: "Parse string columns to datetime with optional format.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "columns", label: "Columns to parse", type: "string_list", required: true },
    { key: "format", label: "strftime format (optional)", type: "string", placeholder: "%Y-%m-%d" },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    const columns = strList(config.columns ?? config.date_columns);
    const fmt = String(config.format ?? "").trim();
    if (!table || !columns.length) {
      return { warnings: ["datetime_parser: table and columns required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const lines = [
      `# ── datetime_parser: ${table} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
    ];
    for (const col of columns) {
      if (fmt) {
        lines.push(`    _df[${JSON.stringify(col)}] = pd.to_datetime(_df[${JSON.stringify(col)}], format=${JSON.stringify(fmt)}, errors='coerce')`);
      } else {
        lines.push(`    _df[${JSON.stringify(col)}] = pd.to_datetime(_df[${JSON.stringify(col)}], errors='coerce')`);
      }
    }
    lines.push(
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[datetime_parser] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[datetime_parser] failed: {_e}")',
      "    raise"
    );
    return { python: lines };
  },
};
