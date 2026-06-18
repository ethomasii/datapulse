/**
 * Fallback compiler for catalog templates without a native/package implementation.
 * Category-aware codegen so 800+ manifest entries are executable, not spec-only.
 */
import { routeComponent, type ComponentRoute } from "@/lib/elt/component-compile-router";
import { getComponentById } from "@/lib/elt/component-registry";
import { escapePyString } from "@/lib/elt/escape-py";
import type { NativeComponentCompileResult } from "@/lib/elt/native-components/types";

const GENERIC_SKIP_TARGETS = new Set(["skip", "catalog_external"]);

export function canCompileGenerically(route: ComponentRoute): boolean {
  return !GENERIC_SKIP_TARGETS.has(route.target);
}

export function compileGenericCatalogComponent(
  componentId: string,
  category: string,
  config: Record<string, unknown>
): NativeComponentCompileResult {
  const route = routeComponent(componentId, category);
  if (!canCompileGenerically(route)) {
    return { warnings: [`${componentId}: no generic compiler for target ${route.target}`] };
  }

  const target = route.target;
  const cat = category.trim().toLowerCase();

  if (target === "quality" || cat === "check") {
    return compileGenericQuality(componentId, config);
  }
  if (target === "monitor" || cat === "sensor" || cat === "observation") {
    return compileGenericMonitor(componentId, config);
  }
  if (target === "dlt" || target === "sling" || cat === "ingestion" || cat === "source" || cat === "sink") {
    return compileGenericIngestion(componentId, config);
  }
  if (target === "dbt" || cat === "dbt") {
    return compileGenericDbt(componentId, config);
  }
  if (target === "python" || cat === "transformation" || cat === "analytics" || cat === "ai") {
    return compileGenericTransform(componentId, config);
  }

  // dagster / integration / infrastructure — emit logged Python passthrough
  return compileGenericPythonPassthrough(componentId, config);
}

function tableFromConfig(config: Record<string, unknown>): string {
  return String(
    config.table ??
      config.output_table ??
      config.table_name ??
      config.asset_name ??
      config.input_table ??
      ""
  ).trim();
}

function compileGenericQuality(componentId: string, config: Record<string, unknown>): NativeComponentCompileResult {
  const table = tableFromConfig(config);
  const cols = Array.isArray(config.not_null)
    ? (config.not_null as unknown[]).map(String).filter(Boolean)
    : Array.isArray(config.columns)
      ? (config.columns as unknown[]).map(String).filter(Boolean)
      : ["id"];

  if (!table) {
    return { warnings: [`${componentId}: table required for quality check`] };
  }

  const tests = cols.map(
    (col) => `assert not_null("${table}", "${col}")  # ${componentId}`
  );
  const sql = cols.map(
    (col) =>
      `SELECT COUNT(*) AS bad_rows FROM ${quoteSqlTable(table)} WHERE ${quoteSqlIdent(col)} IS NULL`
  );

  return {
    tests,
    sql,
    quality: [{ table, not_null: cols }],
    warnings: [`${componentId}: generic quality compiler — not_null on ${cols.join(", ")}`],
  };
}

function compileGenericMonitor(componentId: string, config: Record<string, unknown>): NativeComponentCompileResult {
  const label = String(config.label ?? componentId).trim();
  return {
    configPatch: {
      elt_canvas_sensors: [
        {
          component_id: componentId,
          monitor_type: String(config.monitor_type ?? "custom"),
          label,
          config,
        },
      ],
    },
    warnings: [`${componentId}: generic monitor — saved as canvas sensor metadata`],
  };
}

function compileGenericIngestion(componentId: string, config: Record<string, unknown>): NativeComponentCompileResult {
  const resource = String(
    config.resource_name ?? config.table_name ?? config.table ?? componentId
  ).trim();
  const patch: Record<string, unknown> = {
    elt_native_ingestion_hints: {
      ...(typeof config.elt_native_ingestion_hints === "object" && config.elt_native_ingestion_hints
        ? (config.elt_native_ingestion_hints as Record<string, unknown>)
        : {}),
      [componentId]: { ...config, template_id: componentId },
    },
  };

  if (config.bucket_url || config.s3_path || config.prefix) {
    patch.bucket_url = String(config.bucket_url ?? config.s3_path ?? config.prefix);
    patch.file_glob = String(config.file_glob ?? "**/*");
    patch.resource_name = resource;
  }
  if (config.queue_url) patch.queue_url = config.queue_url;
  if (config.base_url) patch.base_url = config.base_url;

  return {
    configPatch: patch,
    warnings: [`${componentId}: generic ingestion — merged hints into source configuration`],
  };
}

function compileGenericDbt(componentId: string, config: Record<string, unknown>): NativeComponentCompileResult {
  const packagePath = String(config.package_path ?? config.dbt_package_path ?? "").trim();
  if (!packagePath) {
    return { warnings: [`${componentId}: link a dbt project or set package_path`] };
  }
  return {
    configPatch: {
      dbt: {
        enabled: true,
        package_path: packagePath,
        selector: String(config.selector ?? config.select ?? "").trim() || undefined,
      },
    },
    warnings: [`${componentId}: generic dbt — linked package ${packagePath}`],
  };
}

function compileGenericTransform(componentId: string, config: Record<string, unknown>): NativeComponentCompileResult {
  const table = tableFromConfig(config);
  const output = String(config.output_table ?? table).trim();
  const condition = String(config.condition ?? config.filter ?? config.expression ?? "").trim();

  if (!table) {
    return { warnings: [`${componentId}: table required for transform`] };
  }

  const outSchema = output.includes(".") ? output.split(".")[0]! : "public";
  const outName = output.includes(".") ? output.split(".").pop()! : output;

  if (condition) {
    const python = [
      `# ── ${componentId} (generic filter) ──`,
      "import pandas as pd",
      "try:",
      "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
      "    _sql = _dest_client.sql_client()",
      `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`,
      `    _out = _df.query(${JSON.stringify(condition)})`,
      `    _out.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[${componentId}] {len(_out)} rows → ${escapePyString(output)}")`,
      "except Exception as _e:",
      `    print(f"[${componentId}] failed: {_e}")`,
      "    raise",
    ];
    return { python, warnings: [`${componentId}: generic transform with condition`] };
  }

  const python = [
    `# ── ${componentId} (generic copy) ──`,
    "import pandas as pd",
    "try:",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`,
    `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
    `    print(f"[${componentId}] copied {len(_df)} rows → ${escapePyString(output)}")`,
    "except Exception as _e:",
    `    print(f"[${componentId}] failed: {_e}")`,
    "    raise",
  ];
  return { python, warnings: [`${componentId}: generic table copy transform`] };
}

function compileGenericPythonPassthrough(
  componentId: string,
  config: Record<string, unknown>
): NativeComponentCompileResult {
  const table = tableFromConfig(config);
  const python = [
    `# ── ${componentId} (catalog template) ──`,
    `print("[${componentId}] config keys:", ${JSON.stringify(Object.keys(config))})`,
    table ? `print("[${componentId}] table=${escapePyString(table)}")` : "",
  ].filter(Boolean);

  return {
    python,
    warnings: [`${componentId}: catalog template — passthrough Python log step`],
  };
}

function quoteSqlTable(ref: string): string {
  return ref
    .split(".")
    .map((p) => `"${p.replace(/"/g, '""')}"`)
    .join(".");
}

function quoteSqlIdent(col: string): string {
  return `"${col.replace(/"/g, '""')}"`;
}

/** Resolve generic compiler for any manifest id. */
export function resolveGenericCompiler(componentId: string): {
  id: string;
  category: string;
  compile: (config: Record<string, unknown>) => Promise<NativeComponentCompileResult>;
} | null {
  const row = getComponentById(componentId);
  if (!row) return null;
  const route = routeComponent(row.id, row.category);
  if (!canCompileGenerically(route)) return null;
  return {
    id: row.id,
    category: row.category,
    compile: async (config) => compileGenericCatalogComponent(row.id, row.category, config),
  };
}
