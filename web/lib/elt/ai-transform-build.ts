/**
 * Build transform chains from structured steps — dataframe, warehouse SQL, or linked dbt project.
 */
import type { AiPipelineComponentInput } from "@/lib/elt/ai-pipeline-canvas-build";
import type { CanvasGraphEditAction } from "@/lib/elt/canvas-graph-edit";

export type TransformStepOp =
  | "filter"
  | "sort"
  | "aggregate"
  | "select_columns"
  | "drop_duplicates"
  | "limit";

export type TransformBuildStep = {
  op: TransformStepOp;
  /** pandas query or SQL WHERE fragment */
  condition?: string;
  columns?: string[];
  ascending?: boolean | boolean[];
  group_by?: string[];
  /** e.g. { amount: "sum", id: "count" } */
  aggregations?: Record<string, string>;
  limit?: number;
  output_suffix?: string;
};

export type TransformBuildMode = "dataframe" | "warehouse" | "dbt";

export type TransformBuildInput = {
  mode: TransformBuildMode;
  /** Loaded warehouse table (schema.table or table) */
  source_table: string;
  steps: TransformBuildStep[];
  output_schema?: string;
  /** Linked git dbt project — only used when mode is dbt */
  dbt_package_path?: string;
  dbt_target_schema?: string;
  dbt_selector?: string;
};

export type TransformBuildResult = {
  mode: TransformBuildMode;
  components: AiPipelineComponentInput[];
  graph_edits: CanvasGraphEditAction[];
  post_transform_type?: "dbt" | "sql";
  post_transform_code?: string;
  dbt_package_path?: string;
  dbt_target_schema?: string;
  dbt_selector?: string;
  dbt_run_scope?: "all" | "selection";
  messages: string[];
};

function splitTableRef(table: string): { schema: string; name: string; qualified: string } {
  const t = table.trim();
  if (t.includes(".")) {
    const schema = t.split(".")[0]!;
    const name = t.split(".").slice(1).join(".");
    return { schema, name, qualified: t };
  }
  return { schema: "staging", name: t, qualified: `staging.${t}` };
}

function stepOutputTable(
  source: { schema: string; name: string },
  step: TransformBuildStep,
  index: number
): string {
  const suffix = step.output_suffix?.trim() || `${step.op}_${index + 1}`;
  const safe = suffix.replace(/[^a-zA-Z0-9_]/g, "_");
  return `${source.schema}.${source.name}_${safe}`;
}

/** Best-effort pandas-style condition → SQL WHERE */
export function pandasConditionToSql(condition: string): string {
  return condition
    .trim()
    .replace(/==/g, "=")
    .replace(/!=/g, "<>")
    .replace(/\band\b/gi, "AND")
    .replace(/\bor\b/gi, "OR");
}

function aggToSql(aggs: Record<string, string>): string {
  return Object.entries(aggs)
    .map(([col, fn]) => {
      const f = fn.toLowerCase();
      if (f === "count") return `COUNT(${quoteIdent(col)}) AS ${quoteIdent(col)}_count`;
      if (f === "count_distinct" || f === "nunique") {
        return `COUNT(DISTINCT ${quoteIdent(col)}) AS ${quoteIdent(col)}_count_distinct`;
      }
      if (f === "sum") return `SUM(${quoteIdent(col)}) AS ${quoteIdent(col)}_sum`;
      if (f === "avg" || f === "mean") return `AVG(${quoteIdent(col)}) AS ${quoteIdent(col)}_avg`;
      if (f === "min") return `MIN(${quoteIdent(col)}) AS ${quoteIdent(col)}_min`;
      if (f === "max") return `MAX(${quoteIdent(col)}) AS ${quoteIdent(col)}_max`;
      return `${f.toUpperCase()}(${quoteIdent(col)}) AS ${quoteIdent(col)}_${f}`;
    })
    .join(", ");
}

function quoteIdent(id: string): string {
  const safe = id.replace(/"/g, "");
  return `"${safe}"`;
}

function buildStepComponents(
  sourceTable: string,
  steps: TransformBuildStep[],
  execution: "warehouse" | "dataframe"
): AiPipelineComponentInput[] {
  const src = splitTableRef(sourceTable);
  const components: AiPipelineComponentInput[] = [];
  let currentTable = src.qualified;
  const execConfig = execution === "dataframe" ? { execution: "dataframe" } : { execution: "warehouse" };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const out = stepOutputTable(src, step, i);
    const label = step.output_suffix?.trim() || step.op;

    if (step.op === "filter") {
      const condition = String(step.condition ?? "").trim();
      if (!condition) continue;
      components.push({
        component_id: "filter_rows",
        label: `Filter ${label}`,
        config: { table: currentTable, condition, output_table: out, ...execConfig },
      });
      currentTable = out;
      continue;
    }

    if (step.op === "sort") {
      const columns = step.columns ?? [];
      if (!columns.length) continue;
      const asc =
        typeof step.ascending === "boolean"
          ? String(step.ascending)
          : Array.isArray(step.ascending)
            ? step.ascending.map((a) => String(a)).join(",")
            : "true";
      components.push({
        component_id: "sort_rows",
        label: `Sort ${label}`,
        config: { table: currentTable, columns, ascending: asc, output_table: out, ...execConfig },
      });
      currentTable = out;
      continue;
    }

    if (step.op === "aggregate") {
      const groupBy = step.group_by ?? [];
      const aggs = step.aggregations ?? {};
      if (!groupBy.length || !Object.keys(aggs).length) continue;
      components.push({
        component_id: "group_aggregate",
        label: `Aggregate ${label}`,
        config: {
          table: currentTable,
          group_by: groupBy,
          aggregations: JSON.stringify(aggs),
          output_table: out,
          ...execConfig,
        },
      });
      currentTable = out;
      continue;
    }

    if (step.op === "select_columns") {
      const columns = step.columns ?? [];
      if (!columns.length) continue;
      components.push({
        component_id: "select_columns",
        label: `Select ${label}`,
        config: { table: currentTable, columns, output_table: out, ...execConfig },
      });
      currentTable = out;
      continue;
    }

    if (step.op === "drop_duplicates") {
      components.push({
        component_id: "drop_duplicates",
        label: `Dedupe ${label}`,
        config: {
          table: currentTable,
          subset: step.columns ?? [],
          output_table: out,
          ...execConfig,
        },
      });
      currentTable = out;
      continue;
    }

    if (step.op === "limit") {
      const n = Math.max(1, Math.floor(Number(step.limit ?? 100)));
      components.push({
        component_id: "limit_rows",
        label: `Limit ${label}`,
        config: { table: currentTable, limit: n, output_table: out, ...execConfig },
      });
      currentTable = out;
    }
  }

  return components;
}

function buildDataframeComponents(
  sourceTable: string,
  steps: TransformBuildStep[]
): AiPipelineComponentInput[] {
  return buildStepComponents(sourceTable, steps, "dataframe");
}

function buildWarehouseComponents(
  sourceTable: string,
  steps: TransformBuildStep[]
): AiPipelineComponentInput[] {
  return buildStepComponents(sourceTable, steps, "warehouse");
}

function buildWarehouseSqlChain(sourceTable: string, steps: TransformBuildStep[]): string {
  const src = splitTableRef(sourceTable);
  const statements: string[] = [];
  let currentTable = src.qualified;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const out = stepOutputTable(src, step, i);
    const outRef = out.includes(".") ? out.split(".").map(quoteIdent).join(".") : quoteIdent(out);
    const fromRef = currentTable.includes(".")
      ? currentTable.split(".").map(quoteIdent).join(".")
      : quoteIdent(currentTable);

    if (step.op === "filter") {
      const condition = String(step.condition ?? "").trim();
      if (!condition) continue;
      const where = pandasConditionToSql(condition);
      statements.push(
        `CREATE OR REPLACE TABLE ${outRef} AS\nSELECT *\nFROM ${fromRef}\nWHERE ${where}`
      );
      currentTable = out;
      continue;
    }

    if (step.op === "sort") {
      const columns = step.columns ?? [];
      if (!columns.length) continue;
      const asc = step.ascending === false ? "DESC" : "ASC";
      const order = columns.map((c) => `${quoteIdent(c)} ${asc}`).join(", ");
      statements.push(
        `CREATE OR REPLACE TABLE ${outRef} AS\nSELECT *\nFROM ${fromRef}\nORDER BY ${order}`
      );
      currentTable = out;
      continue;
    }

    if (step.op === "aggregate") {
      const groupBy = step.group_by ?? [];
      const aggs = step.aggregations ?? {};
      if (!groupBy.length || !Object.keys(aggs).length) continue;
      const groupSql = groupBy.map(quoteIdent).join(", ");
      const selectAggs = aggToSql(aggs);
      statements.push(
        `CREATE OR REPLACE TABLE ${outRef} AS\nSELECT ${groupSql}, ${selectAggs}\nFROM ${fromRef}\nGROUP BY ${groupSql}`
      );
      currentTable = out;
      continue;
    }

    if (step.op === "select_columns") {
      const columns = step.columns ?? [];
      if (!columns.length) continue;
      const cols = columns.map(quoteIdent).join(", ");
      statements.push(`CREATE OR REPLACE TABLE ${outRef} AS\nSELECT ${cols}\nFROM ${fromRef}`);
      currentTable = out;
      continue;
    }

    if (step.op === "drop_duplicates") {
      statements.push(`CREATE OR REPLACE TABLE ${outRef} AS\nSELECT DISTINCT *\nFROM ${fromRef}`);
      currentTable = out;
      continue;
    }

    if (step.op === "limit") {
      const n = Math.max(1, Math.floor(Number(step.limit ?? 100)));
      statements.push(`CREATE OR REPLACE TABLE ${outRef} AS\nSELECT *\nFROM ${fromRef}\nLIMIT ${n}`);
      currentTable = out;
    }
  }

  return statements.join(";\n\n") + (statements.length ? ";" : "");
}

function graphEditsForComponents(components: AiPipelineComponentInput[]): CanvasGraphEditAction[] {
  if (!components.length) return [];
  const edits: CanvasGraphEditAction[] = [];
  let after = "dest";
  for (const c of components) {
    const label = (c.label ?? c.component_id).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24);
    edits.push({
      op: "add_component",
      component_id: c.component_id,
      label: c.label,
      config: c.config,
      after,
    });
    after = label || c.component_id;
  }
  return edits;
}

export function buildTransformPipeline(input: TransformBuildInput): TransformBuildResult {
  const requestedMode = input.mode;
  const sourceTable = String(input.source_table ?? "").trim();
  const steps = input.steps ?? [];
  const messages: string[] = [];

  if (!sourceTable) {
    return { mode: requestedMode, components: [], graph_edits: [], messages: ["source_table is required"] };
  }
  if (!steps.length) {
    return {
      mode: requestedMode,
      components: [],
      graph_edits: [],
      messages: ["At least one transform step is required"],
    };
  }

  if (requestedMode === "dataframe") {
    const components = buildDataframeComponents(sourceTable, steps);
    messages.push(
      `Dataframe path: ${components.length} step(s) — runs in-memory on worker after load (filter/sort/aggregate via native components).`
    );
    return {
      mode: "dataframe",
      components,
      graph_edits: graphEditsForComponents(components),
      messages,
    };
  }

  const sql = buildWarehouseSqlChain(sourceTable, steps);
  if (!sql.trim()) {
    return { mode: requestedMode, components: [], graph_edits: [], messages: ["No SQL generated from steps"] };
  }

  const packagePath = String(input.dbt_package_path ?? "").trim();
  const warehouseComponents = buildWarehouseComponents(sourceTable, steps);

  if (requestedMode === "dbt" && packagePath) {
    const selector = String(input.dbt_selector ?? "").trim() || "tag:eltpulse_ai";
    messages.push(
      `dbt project: linked transform + ${warehouseComponents.length} warehouse SQL preview step(s) on canvas.`
    );
    return {
      mode: "dbt",
      components: warehouseComponents,
      graph_edits: [
        ...graphEditsForComponents(warehouseComponents),
        {
          op: "add_transform",
          tool: "dbt",
          label: "dbt project",
          after: "dest",
          package_path: packagePath,
          selector,
        },
      ],
      post_transform_type: "sql",
      post_transform_code: sql,
      dbt_package_path: packagePath,
      dbt_target_schema: input.dbt_target_schema,
      dbt_selector: selector,
      dbt_run_scope: "selection",
      messages,
    };
  }

  if (requestedMode === "dbt" && !packagePath) {
    messages.push("dbt project mode needs dbt_package_path — using warehouse SQL components instead.");
  }

  if (warehouseComponents.length) {
    messages.push(
      `Warehouse SQL: ${warehouseComponents.length} native transform step(s) after load (CTAS — not a dbt project).`
    );
    return {
      mode: "warehouse",
      components: warehouseComponents,
      graph_edits: graphEditsForComponents(warehouseComponents),
      messages,
    };
  }

  messages.push(
    "Warehouse SQL: inline CTAS after load. Link a dbt project at /catalog/dbt when logic should live in git."
  );
  return {
    mode: "warehouse",
    components: [],
    graph_edits: [
      {
        op: "add_transform",
        tool: "sql",
        label: "Warehouse SQL",
        after: "dest",
        code: sql,
      },
    ],
    post_transform_type: "sql",
    post_transform_code: sql,
    messages,
  };
}

export function transformBuildModeLabel(mode: TransformBuildMode): string {
  switch (mode) {
    case "dataframe":
      return "Dataframe";
    case "warehouse":
      return "Warehouse SQL";
    case "dbt":
      return "dbt project";
  }
}

/** Resolve AI/API mode — legacy `dbt` without a linked project maps to warehouse SQL. */
export function normalizeTransformBuildMode(
  modeRaw: string | undefined,
  opts?: { userQuery?: string; dbtPackagePath?: string }
): TransformBuildMode {
  const raw = String(modeRaw ?? "auto").toLowerCase();
  const packagePath = String(opts?.dbtPackagePath ?? "").trim();

  if (raw === "dataframe") return "dataframe";
  if (raw === "warehouse") return "warehouse";
  if (raw === "dbt") return packagePath ? "dbt" : "warehouse";

  return inferTransformMode(opts?.userQuery ?? "", packagePath);
}

/** Infer transform mode — dbt default for production; warehouse for canvas/recipes; dataframe legacy only. */
export function inferTransformMode(query: string, dbtPackagePath?: string): TransformBuildMode {
  if (String(dbtPackagePath ?? "").trim()) return "dbt";

  const q = query.toLowerCase();
  if (/\b(dataframe|pandas|legacy|in.?memory|worker python)\b/.test(q)) {
    return "dataframe";
  }
  if (
    /\b(recipe|medallion|canvas component|warehouse sql|ctas|native component|quick mart|lake starter|build_lake)\b/.test(
      q
    )
  ) {
    return "warehouse";
  }
  return "dbt";
}
