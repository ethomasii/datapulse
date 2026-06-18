import { escapePyString } from "@/lib/elt/escape-py";
import type { NativeComponentDefinition } from "../types";
import { joinHowFromTemplate } from "./_config-helpers";
import {
  sqlCreateTableAs,
  sqlJoinKeyword,
  sqlQualifiedTable,
  useDataframeExecution,
} from "./_sql-helpers";

function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function compileJoinDataframe(
  left: string,
  right: string,
  output: string,
  how: string,
  on: string[],
  leftOn: string[],
  rightOn: string[],
  warnings: string[]
): { python: string[]; warnings?: string[] } {
  const onPy = on.length ? `[${on.map((c) => `"${escapePyString(c)}"`).join(", ")}]` : "None";
  const leftOnPy = leftOn.length
    ? `[${leftOn.map((c) => `"${escapePyString(c)}"`).join(", ")}]`
    : "None";
  const rightOnPy = rightOn.length
    ? `[${rightOn.map((c) => `"${escapePyString(c)}"`).join(", ")}]`
    : "None";

  const mergeKw =
    on.length > 0
      ? `on=${onPy}`
      : leftOn.length && rightOn.length
        ? `left_on=${leftOnPy}, right_on=${rightOnPy}`
        : "";

  const outParts = output.split(".");
  const outSchema = outParts.length > 1 ? outParts[0]! : "public";
  const outName = outParts.length > 1 ? outParts.slice(1).join(".") : output;

  const python = [
    `# ── join_tables (dataframe): ${left} ⋈ ${right} → ${output} ──`,
    "import pandas as pd",
    "try:",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _left = pd.read_sql('SELECT * FROM ${escapePyString(left)}', _sql._engine)`,
    `    _right = pd.read_sql('SELECT * FROM ${escapePyString(right)}', _sql._engine)`,
    mergeKw
      ? `    _joined = _left.merge(_right, how="${escapePyString(how)}", ${mergeKw}, suffixes=("_left", "_right"))`
      : `    _joined = _left.merge(_right, how="${escapePyString(how)}", suffixes=("_left", "_right"))`,
    `    _joined.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
    `    print(f"[join_tables] wrote {len(_joined)} rows to ${escapePyString(output)}")`,
    "except Exception as _join_err:",
    '    print(f"[join_tables] failed: {_join_err}")',
    "    raise",
  ];

  return { python, warnings: warnings.length ? warnings : undefined };
}

function buildJoinOnClause(on: string[], leftOn: string[], rightOn: string[]): string {
  if (on.length) {
    return on
      .map((c) => `l."${c.replace(/"/g, '""')}" = r."${c.replace(/"/g, '""')}"`)
      .join(" AND ");
  }
  if (leftOn.length && rightOn.length) {
    const pairs = Math.min(leftOn.length, rightOn.length);
    const clauses: string[] = [];
    for (let i = 0; i < pairs; i++) {
      const lo = leftOn[i]!;
      const ro = rightOn[i]!;
      clauses.push(`l."${lo.replace(/"/g, '""')}" = r."${ro.replace(/"/g, '""')}"`);
    }
    return clauses.join(" AND ");
  }
  return "1 = 1";
}

export const joinTablesComponent: NativeComponentDefinition = {
  id: "join_tables",
  aliases: [
    "dataframe_join",
    "lookup",
    "dataframe_lookup",
    "warehouse_join",
    "inner_join",
    "left_join",
    "right_join",
    "outer_join",
    "full_outer_join",
    "customer_360_join",
  ],
  name: "Join tables",
  category: "transformation",
  description: "Join two warehouse tables via SQL push-down (default) or dataframe merge.",
  compileTarget: "dbt",
  dagsterOnlyFields: [
    "asset_name",
    "left_asset_key",
    "right_asset_key",
    "group_name",
    "partition_type",
    "partition_start",
    "partition_date_column",
    "partition_values",
    "partition_static_dim",
    "partition_static_column",
    "owners",
    "asset_tags",
    "kinds",
    "freshness_max_lag_minutes",
    "freshness_cron",
    "column_lineage",
    "include_preview_metadata",
    "preview_rows",
    "deps",
    "retry_policy_max_retries",
    "retry_policy_delay_seconds",
    "retry_policy_backoff",
    "dynamic_partition_name",
    "partition_dimensions",
  ],
  fields: [
    {
      key: "left_table",
      label: "Left table",
      description: "Fully-qualified table name (schema.table)",
      type: "string",
      required: true,
      placeholder: "staging.orders",
    },
    {
      key: "right_table",
      label: "Right table",
      type: "string",
      required: true,
      placeholder: "staging.customers",
    },
    {
      key: "how",
      label: "Join type",
      type: "select",
      options: ["inner", "left", "right", "outer"],
      default: "inner",
    },
    {
      key: "on",
      label: "Join columns",
      description: "Same column name(s) on both tables",
      type: "string_list",
      placeholder: "customer_id",
    },
    {
      key: "left_on",
      label: "Left join columns",
      type: "string_list",
    },
    {
      key: "right_on",
      label: "Right join columns",
      type: "string_list",
    },
    {
      key: "output_table",
      label: "Output table",
      description: "Where to write the joined result",
      type: "string",
      required: true,
      placeholder: "staging.orders_enriched",
    },
    {
      key: "execution",
      label: "Execution",
      type: "select",
      options: ["warehouse", "dataframe"],
      default: "warehouse",
    },
  ],
  compile(config) {
    const left = String(config.left_table ?? config.left_asset_key ?? "").trim();
    const right = String(config.right_table ?? config.right_asset_key ?? "").trim();
    const output = String(config.output_table ?? config.asset_name ?? "").trim();
    const how = joinHowFromTemplate(config, "inner");
    const on = strList(config.on);
    const leftOn = strList(config.left_on);
    const rightOn = strList(config.right_on);

    const warnings: string[] = [];
    if (!left || !right) {
      return { warnings: ["join_tables: left_table and right_table are required"], sql: [], python: [] };
    }
    if (!output) {
      return { warnings: ["join_tables: output_table is required"], sql: [], python: [] };
    }
    if (!on.length && !(leftOn.length && rightOn.length)) {
      warnings.push("join_tables: provide 'on' or both left_on and right_on");
    }

    if (useDataframeExecution(config)) {
      return compileJoinDataframe(left, right, output, how, on, leftOn, rightOn, warnings);
    }

    const joinKw = sqlJoinKeyword(how);
    const onClause = buildJoinOnClause(on, leftOn, rightOn);
    const leftQ = sqlQualifiedTable(left);
    const rightQ = sqlQualifiedTable(right);
    const sql = [
      sqlCreateTableAs(
        output,
        `SELECT l.*, r.*\nFROM ${leftQ} AS l\n${joinKw} ${rightQ} AS r\n  ON ${onClause}`
      ),
    ];

    return { sql, warnings: warnings.length ? warnings : undefined };
  },
};
