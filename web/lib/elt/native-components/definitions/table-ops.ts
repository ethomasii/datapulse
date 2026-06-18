import { escapePyString } from "@/lib/elt/escape-py";
import type { NativeComponentDefinition } from "../types";
import { pandasReadTable, pandasWriteTable, strList } from "./_pandas-helpers";

function outputParts(output: string) {
  const outSchema = output.includes(".") ? output.split(".")[0]! : "public";
  const outName = output.includes(".") ? output.split(".").pop()! : output;
  return { outSchema, outName };
}

export const groupAggregateComponent: NativeComponentDefinition = {
  id: "group_aggregate",
  aliases: ["aggregate_table", "group_by"],
  name: "Group & aggregate",
  category: "transformation",
  description: "Group by columns and compute aggregations (pandas groupby).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "group_by", label: "Group by columns", type: "string_list", required: true },
    {
      key: "aggregations",
      label: "Aggregations JSON",
      description: 'e.g. {"amount":"sum","id":"count"}',
      type: "text",
      required: true,
    },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? "").trim();
    const groupBy = strList(config.group_by ?? config.groupby);
    let aggs: Record<string, string> = {};
    const raw = config.aggregations ?? config.agg;
    if (typeof raw === "string") {
      try {
        aggs = JSON.parse(raw) as Record<string, string>;
      } catch {
        return { warnings: ["group_aggregate: aggregations must be valid JSON"], python: [] };
      }
    } else if (raw && typeof raw === "object") {
      aggs = Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
    }
    if (!table || !output || !groupBy.length || !Object.keys(aggs).length) {
      return { warnings: ["group_aggregate: table, group_by, aggregations, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const groupPy = `[${groupBy.map((c) => JSON.stringify(c)).join(", ")}]`;
    const aggPy = JSON.stringify(aggs);
    const python = [
      `# ── group_aggregate: ${table} → ${output} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df.groupby(${groupPy}, as_index=False).agg(${aggPy})`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[group_aggregate] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _grp_err:",
      '    print(f"[group_aggregate] failed: {_grp_err}")',
      "    raise",
    ];
    return { python };
  },
};

export const sortRowsComponent: NativeComponentDefinition = {
  id: "sort_rows",
  name: "Sort rows",
  category: "transformation",
  description: "Sort a table by one or more columns.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "columns", label: "Sort columns", type: "string_list", required: true },
    {
      key: "ascending",
      label: "Ascending",
      description: "true/false or comma list matching columns",
      type: "string",
      default: "true",
    },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    const columns = strList(config.columns ?? config.sort_by);
    const ascRaw = String(config.ascending ?? "true").trim();
    const ascPy =
      columns.length > 1 && ascRaw.includes(",")
        ? `[${ascRaw
            .split(",")
            .map((s) => (s.trim().toLowerCase() !== "false" ? "True" : "False"))
            .join(", ")}]`
        : ascRaw.toLowerCase() !== "false"
          ? "True"
          : "False";
    if (!table || !columns.length) {
      return { warnings: ["sort_rows: table and columns required"], python: [] };
    }
    const colsPy = `[${columns.map((c) => JSON.stringify(c)).join(", ")}]`;
    const python = [
      `# ── sort_rows: ${table} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df.sort_values(by=${colsPy}, ascending=${ascPy})`,
      ...pandasWriteTable(output, "sort_rows"),
      "except Exception as _sort_err:",
      '    print(f"[sort_rows] failed: {_sort_err}")',
      "    raise",
    ];
    return { python };
  },
};

export const limitRowsComponent: NativeComponentDefinition = {
  id: "limit_rows",
  aliases: ["head_rows", "take_rows"],
  name: "Limit rows",
  category: "transformation",
  description: "Keep first N rows of a table (head).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "limit", label: "Row limit", type: "number", default: 1000, required: true },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    const limit = Math.max(1, Math.floor(Number(config.limit ?? config.n ?? 1000)));
    if (!table) return { warnings: ["limit_rows: table required"], python: [] };
    const python = [
      `# ── limit_rows: ${table} (n=${limit}) ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df.head(${limit})`,
      ...pandasWriteTable(output, "limit_rows"),
      "except Exception as _lim_err:",
      '    print(f"[limit_rows] failed: {_lim_err}")',
      "    raise",
    ];
    return { python };
  },
};

export const fillNullsComponent: NativeComponentDefinition = {
  id: "fill_nulls",
  aliases: ["impute_nulls"],
  name: "Fill nulls",
  category: "transformation",
  description: "Fill null values with constants per column (pandas fillna).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "values",
      label: "Fill values JSON",
      description: 'e.g. {"status":"unknown","amount":0}',
      type: "text",
      required: true,
    },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    let values: Record<string, unknown> = {};
    const raw = config.values ?? config.fillna;
    if (typeof raw === "string") {
      try {
        values = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return { warnings: ["fill_nulls: values must be valid JSON"], python: [] };
      }
    } else if (raw && typeof raw === "object") {
      values = raw as Record<string, unknown>;
    }
    if (!table || !Object.keys(values).length) {
      return { warnings: ["fill_nulls: table and values required"], python: [] };
    }
    const valuesPy = JSON.stringify(values);
    const python = [
      `# ── fill_nulls: ${table} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df.fillna(${valuesPy})`,
      ...pandasWriteTable(output, "fill_nulls"),
      "except Exception as _fill_err:",
      '    print(f"[fill_nulls] failed: {_fill_err}")',
      "    raise",
    ];
    return { python };
  },
};

export const replaceValuesComponent: NativeComponentDefinition = {
  id: "replace_values",
  name: "Replace values",
  category: "transformation",
  description: "Replace cell values in selected columns (pandas replace).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "mapping",
      label: "Replace mapping JSON",
      description: 'Column → {old: new}, e.g. {"status":{"pending":"open"}}',
      type: "text",
      required: true,
    },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    let mapping: Record<string, unknown> = {};
    const raw = config.mapping ?? config.replace;
    if (typeof raw === "string") {
      try {
        mapping = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return { warnings: ["replace_values: mapping must be valid JSON"], python: [] };
      }
    } else if (raw && typeof raw === "object") {
      mapping = raw as Record<string, unknown>;
    }
    if (!table || !Object.keys(mapping).length) {
      return { warnings: ["replace_values: table and mapping required"], python: [] };
    }
    const mapPy = JSON.stringify(mapping);
    const python = [
      `# ── replace_values: ${table} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df.replace(${mapPy})`,
      ...pandasWriteTable(output, "replace_values"),
      "except Exception as _rep_err:",
      '    print(f"[replace_values] failed: {_rep_err}")',
      "    raise",
    ];
    return { python };
  },
};

export const sampleRowsComponent: NativeComponentDefinition = {
  id: "sample_rows",
  name: "Sample rows",
  category: "transformation",
  description: "Random sample of rows (pandas sample).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "n", label: "Sample size", type: "number", default: 1000 },
    {
      key: "frac",
      label: "Fraction (0–1)",
      description: "Use instead of n for proportional sample",
      type: "number",
    },
    { key: "random_state", label: "Random seed", type: "number" },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? "").trim();
    const n = config.n != null ? Math.max(1, Math.floor(Number(config.n))) : null;
    const frac = config.frac != null ? Number(config.frac) : null;
    const seed = config.random_state != null ? Math.floor(Number(config.random_state)) : null;
    if (!table || !output || (n == null && frac == null)) {
      return { warnings: ["sample_rows: table, output_table, and n or frac required"], python: [] };
    }
    const sampleKw =
      frac != null && !Number.isNaN(frac)
        ? `frac=${frac}${seed != null ? `, random_state=${seed}` : ""}`
        : `n=${n ?? 1000}${seed != null ? `, random_state=${seed}` : ""}`;
    const python = [
      `# ── sample_rows: ${table} → ${output} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df.sample(${sampleKw})`,
      ...pandasWriteTable(output, "sample_rows"),
      "except Exception as _samp_err:",
      '    print(f"[sample_rows] failed: {_samp_err}")',
      "    raise",
    ];
    return { python };
  },
};

export const addColumnExprComponent: NativeComponentDefinition = {
  id: "add_column_expr",
  aliases: ["computed_column", "derive_column"],
  name: "Add computed column",
  category: "transformation",
  description: "Add a column via pandas eval expression.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "New column name", type: "string", required: true },
    {
      key: "expression",
      label: "Expression",
      description: "pandas eval, e.g. amount * 1.1",
      type: "text",
      required: true,
    },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    const column = String(config.column ?? config.name ?? "").trim();
    const expression = String(config.expression ?? config.expr ?? "").trim();
    if (!table || !column || !expression) {
      return { warnings: ["add_column_expr: table, column, expression required"], python: [] };
    }
    const python = [
      `# ── add_column_expr: ${table}.${column} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df[${JSON.stringify(column)}] = _df.eval(${JSON.stringify(expression)})`,
      ...pandasWriteTable(output, "add_column_expr"),
      "except Exception as _add_err:",
      '    print(f"[add_column_expr] failed: {_add_err}")',
      "    raise",
    ];
    return { python };
  },
};
