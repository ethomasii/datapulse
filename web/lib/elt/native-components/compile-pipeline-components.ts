import type { PipelineComponentSpec } from "@/lib/elt/declarative-pipeline-spec";
import { resolveComponentCompiler } from "@/lib/elt/component-packages";
import { getNativeComponent, resolveNativeComponentId } from "./registry";
import { resetMcpPreambleFlagForTests } from "./mcp-python-runtime";
import { hydrateComponentMcpConfig, loadMcpServersForCompile } from "@/lib/elt/mcp-server/resolve";
import { normalizeMcpVirtualConfig } from "@/lib/elt/mcp-server/virtual-components";
import type { CompiledPipelineComponents, NativeComponentCompileResult } from "./types";
import { isDataframeExecution } from "./definitions/_sql-helpers";
import {
  canChainCtas,
  flushFusedSqlSegment,
  isFusibleCtasStatement,
  isSqlFusionEnabled,
  parseCtasStatement,
  shouldMaterializeStep,
} from "./fuse-warehouse-sql";
import {
  dropScratchTableSql,
  ensureScratchSchemaSql,
  rewriteCtasToScratchTable,
  scratchOutputTables,
} from "./eltpulse-scratch";

function parseEltComponents(raw: unknown): PipelineComponentSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is PipelineComponentSpec =>
      c &&
      typeof c === "object" &&
      typeof (c as PipelineComponentSpec).id === "string" &&
      typeof (c as PipelineComponentSpec).type === "string"
  );
}

function topoOrder(components: PipelineComponentSpec[]): PipelineComponentSpec[] {
  if (components.length <= 1) return components;
  const byId = new Map(components.map((c) => [c.id, c]));
  const indeg = new Map<string, number>();
  for (const c of components) indeg.set(c.id, 0);
  for (const c of components) {
    for (const dep of c.after ?? []) {
      if (byId.has(dep)) indeg.set(c.id, (indeg.get(c.id) ?? 0) + 1);
    }
  }
  const q = components.filter((c) => (indeg.get(c.id) ?? 0) === 0);
  const out: PipelineComponentSpec[] = [];
  while (q.length) {
    const c = q.shift()!;
    out.push(c);
    for (const other of components) {
      if ((other.after ?? []).includes(c.id)) {
        indeg.set(other.id, (indeg.get(other.id) ?? 0) - 1);
        if (indeg.get(other.id) === 0) q.push(other);
      }
    }
  }
  for (const c of components) {
    if (!out.some((x) => x.id === c.id)) out.push(c);
  }
  return out;
}

function mergeConfigPatch(
  config: Record<string, unknown>,
  patch: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(patch)) {
    if (key === "elt_canvas_sensors" && Array.isArray(value)) {
      const existing = Array.isArray(config.elt_canvas_sensors)
        ? (config.elt_canvas_sensors as unknown[])
        : [];
      config.elt_canvas_sensors = [...existing, ...value];
      continue;
    }
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      config[key] &&
      typeof config[key] === "object" &&
      !Array.isArray(config[key])
    ) {
      config[key] = { ...(config[key] as Record<string, unknown>), ...(value as Record<string, unknown>) };
    } else {
      config[key] = value;
    }
  }
}

/**
 * Compile elt_components[] into executable post-transform Python/SQL and quality tests.
 * Sync path: built-in TS compilers only (tests / legacy).
 */
export function compileNativePipelineComponents(
  sourceConfiguration: Record<string, unknown>
): { config: Record<string, unknown>; result: CompiledPipelineComponents } {
  return compilePipelineComponentsSync(sourceConfiguration);
}

function compilePipelineComponentsSync(
  sourceConfiguration: Record<string, unknown>
): { config: Record<string, unknown>; result: CompiledPipelineComponents } {
  const config = { ...sourceConfiguration };
  const components = topoOrder(parseEltComponents(config.elt_components));

  const pythonBlocks: string[] = [];
  const sqlStatements: string[] = [];
  const sqlSegment: string[] = [];
  const testLines: string[] = [];
  const quality: CompiledPipelineComponents["quality"] = [];
  const warnings: string[] = [];
  let compiled = false;
  const fusionEnabled = isSqlFusionEnabled(config);
  const pipelineName = String(config.pipeline_name ?? config.name ?? "pipeline");
  const scratchByLogical = scratchOutputTables(components, { pipelineName });
  const acc: SqlFusionAccumulator = {
    pythonBlocks,
    sqlStatements,
    sqlSegment,
    scratchTables: new Set(),
    testLines,
    quality,
    warnings,
  };

  for (const comp of components) {
    let cfg: Record<string, unknown> = {
      ...(comp.config ?? {}),
      template_id: comp.config?.template_id ?? comp.id,
    };
    cfg = normalizeMcpVirtualConfig(cfg);
    const nativeId = resolveNativeComponentId(cfg) ?? comp.id;
    const native = getNativeComponent(nativeId);
    if (!native) {
      warnings.push(`No native compiler for component '${nativeId}' — stored in spec only`);
      continue;
    }

    const out = native.compile(cfg);
    ingestCompileOutput(config, cfg, out, acc, fusionEnabled, scratchByLogical);
    compiled = true;
  }

  flushSqlFusionSegment(acc, fusionEnabled, scratchByLogical);

  if (acc.scratchTables.size) {
    config.elt_scratch_tables = Array.from(acc.scratchTables);
  }

  finalizeCompiledConfig(config, {
    pythonBlocks,
    sqlStatements: prependScratchPreamble([...sqlStatements], acc.scratchTables),
    testLines,
    quality,
    compiled,
  });
  const finalSql = prependScratchPreamble([...sqlStatements], acc.scratchTables);
  return {
    config,
    result: { pythonBlocks, sqlStatements: finalSql, testLines, quality, warnings, compiled },
  };
}

/**
 * Async compile: remote package compile.mjs first, then built-in TS fallback.
 */
export async function compilePipelineComponentsAsync(
  sourceConfiguration: Record<string, unknown>,
  options?: { workspaceCatalogUrls?: string[] | null; ownerIds?: string[] }
): Promise<{ config: Record<string, unknown>; result: CompiledPipelineComponents }> {
  resetMcpPreambleFlagForTests();
  const config = { ...sourceConfiguration };
  const components = topoOrder(parseEltComponents(config.elt_components));

  let mcpServers = new Map<string, import("@/lib/elt/mcp-server/types").ResolvedMcpServer>();
  if (options?.ownerIds?.length) {
    const cfgs = components.map((c) => (c.config ?? {}) as Record<string, unknown>);
    mcpServers = await loadMcpServersForCompile(options.ownerIds, cfgs);
  }

  const pythonBlocks: string[] = [];
  const sqlStatements: string[] = [];
  const sqlSegment: string[] = [];
  const testLines: string[] = [];
  const quality: CompiledPipelineComponents["quality"] = [];
  const warnings: string[] = [];
  let compiled = false;
  const fusionEnabled = isSqlFusionEnabled(config);
  const pipelineName = String(config.pipeline_name ?? config.name ?? "pipeline");
  const scratchByLogical = scratchOutputTables(components, { pipelineName });
  const acc: SqlFusionAccumulator = {
    pythonBlocks,
    sqlStatements,
    sqlSegment,
    scratchTables: new Set(),
    testLines,
    quality,
    warnings,
  };

  for (const comp of components) {
    let cfg: Record<string, unknown> = {
      ...(comp.config ?? {}),
      template_id: comp.config?.template_id ?? comp.id,
    };
    cfg = normalizeMcpVirtualConfig(cfg);
    cfg = hydrateComponentMcpConfig(cfg, mcpServers);
    const nativeId = resolveNativeComponentId(cfg) ?? comp.id;
    const compiler = await resolveComponentCompiler(nativeId, {
      sourceConfiguration: config,
      workspaceCatalogUrls: options?.workspaceCatalogUrls,
    });
    if (!compiler) {
      warnings.push(`No compiler for component '${nativeId}' — stored in spec only`);
      continue;
    }

    try {
      const out = await compiler.compile(cfg);
      ingestCompileOutput(config, cfg, out, acc, fusionEnabled, scratchByLogical);
      compiled = true;
      if (compiler.source === "package") {
        config.elt_components_package_sources = {
          ...(typeof config.elt_components_package_sources === "object" &&
          config.elt_components_package_sources
            ? (config.elt_components_package_sources as Record<string, string>)
            : {}),
          [nativeId]: compiler.catalogId ?? "package",
        };
      }
    } catch (err) {
      warnings.push(
        `Compile failed for '${nativeId}': ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  flushSqlFusionSegment(acc, fusionEnabled, scratchByLogical);

  if (acc.scratchTables.size) {
    config.elt_scratch_tables = Array.from(acc.scratchTables);
  }

  finalizeCompiledConfig(config, {
    pythonBlocks,
    sqlStatements: prependScratchPreamble([...sqlStatements], acc.scratchTables),
    testLines,
    quality,
    compiled,
  });
  return {
    config,
    result: { pythonBlocks, sqlStatements: prependScratchPreamble([...sqlStatements], acc.scratchTables), testLines, quality, warnings, compiled },
  };
}

function prependScratchPreamble(statements: string[], scratchTables: Set<string>): string[] {
  if (!scratchTables.size) return statements;
  const preamble = [
    ensureScratchSchemaSql(),
    ...Array.from(scratchTables).map((t) => dropScratchTableSql(t)),
  ];
  return [...preamble, ...statements];
}

function applyCompileOutput(
  config: Record<string, unknown>,
  out: {
    python?: string[];
    sql?: string[];
    tests?: string[];
    quality?: CompiledPipelineComponents["quality"];
    configPatch?: Record<string, unknown>;
    warnings?: string[];
  },
  acc: {
    pythonBlocks: string[];
    sqlStatements: string[];
    testLines: string[];
    quality: CompiledPipelineComponents["quality"];
    warnings: string[];
  }
): void {
  if (out.python?.length) acc.pythonBlocks.push(...out.python);
  if (out.tests?.length) acc.testLines.push(...out.tests);
  if (out.quality?.length) acc.quality.push(...out.quality);
  if (out.configPatch && Object.keys(out.configPatch).length) {
    mergeConfigPatch(config, out.configPatch);
  }
  if (out.warnings?.length) acc.warnings.push(...out.warnings);
}

type SqlFusionAccumulator = {
  pythonBlocks: string[];
  sqlStatements: string[];
  sqlSegment: string[];
  scratchTables: Set<string>;
  testLines: string[];
  quality: CompiledPipelineComponents["quality"];
  warnings: string[];
};

function applyScratchRewrite(
  sql: string,
  scratchByLogical: Map<string, string>
): { sql: string; scratchTable: string | null } {
  const parsed = parseCtasStatement(sql);
  if (!parsed) return { sql, scratchTable: null };
  const scratch = scratchByLogical.get(parsed.outputTable);
  if (!scratch) return { sql, scratchTable: null };
  return { sql: rewriteCtasToScratchTable(sql, scratch), scratchTable: scratch };
}

function flushSqlFusionSegment(
  acc: SqlFusionAccumulator,
  fusionEnabled: boolean,
  scratchByLogical: Map<string, string>
): void {
  if (!acc.sqlSegment.length) return;
  let statements: string[];
  let fusedCount = 0;
  if (fusionEnabled && acc.sqlSegment.length > 1) {
    const flushed = flushFusedSqlSegment(acc.sqlSegment);
    statements = flushed.statements;
    fusedCount = flushed.fusedCount;
    if (fusedCount > 1) {
      acc.warnings.push(`Fused ${fusedCount} warehouse SQL steps into one CTAS.`);
    }
  } else {
    statements = [...acc.sqlSegment];
  }
  for (const stmt of statements) {
    const { sql: rewritten, scratchTable } = applyScratchRewrite(stmt, scratchByLogical);
    acc.sqlStatements.push(rewritten);
    if (scratchTable) acc.scratchTables.add(scratchTable);
  }
  acc.sqlSegment = [];
}

function appendCompiledSql(
  cfg: Record<string, unknown>,
  out: NativeComponentCompileResult,
  acc: SqlFusionAccumulator,
  fusionEnabled: boolean,
  scratchByLogical: Map<string, string>
): void {
  if (!out.sql?.length) return;

  const materialize = shouldMaterializeStep(cfg);
  if (materialize) flushSqlFusionSegment(acc, fusionEnabled, scratchByLogical);

  for (const stmt of out.sql) {
    const fusible =
      fusionEnabled && !isDataframeExecution(cfg) && isFusibleCtasStatement(stmt);

    if (!fusible) {
      flushSqlFusionSegment(acc, fusionEnabled, scratchByLogical);
      const { sql: rewritten, scratchTable } = applyScratchRewrite(stmt, scratchByLogical);
      acc.sqlStatements.push(rewritten);
      if (scratchTable) acc.scratchTables.add(scratchTable);
      continue;
    }

    if (acc.sqlSegment.length) {
      const prev = parseCtasStatement(acc.sqlSegment[acc.sqlSegment.length - 1]!);
      const next = parseCtasStatement(stmt);
      if (!prev || !next || !canChainCtas(prev, next)) {
        flushSqlFusionSegment(acc, fusionEnabled, scratchByLogical);
      }
    }
    acc.sqlSegment.push(stmt);
  }

  if (materialize) flushSqlFusionSegment(acc, fusionEnabled, scratchByLogical);
}

function ingestCompileOutput(
  config: Record<string, unknown>,
  cfg: Record<string, unknown>,
  out: NativeComponentCompileResult,
  acc: SqlFusionAccumulator,
  fusionEnabled: boolean,
  scratchByLogical: Map<string, string>
): void {
  if (out.python?.length) {
    flushSqlFusionSegment(acc, fusionEnabled, scratchByLogical);
  }
  applyCompileOutput(config, out, acc);
  appendCompiledSql(cfg, out, acc, fusionEnabled, scratchByLogical);
}

function finalizeCompiledConfig(
  config: Record<string, unknown>,
  state: {
    pythonBlocks: string[];
    sqlStatements: string[];
    testLines: string[];
    quality: CompiledPipelineComponents["quality"];
    compiled: boolean;
  }
): void {
  const { pythonBlocks, sqlStatements, testLines, quality, compiled } = state;

  if (pythonBlocks.length) {
    const existing = config.post_transform;
    const existingObj =
      existing && typeof existing === "object" ? (existing as Record<string, unknown>) : null;
    const existingCode = existingObj ? String(existingObj.code ?? "").trim() : "";

    const pyParts = [...pythonBlocks];
    if (sqlStatements.length) {
      const stmtLines = sqlStatements
        .map((s) => `        """${s.replace(/"""/g, "'''")}"""`)
        .join(",\n");
      pyParts.push(
        "# ── component SQL checks ──",
        "try:",
        "    import sqlalchemy",
        "    _pt_engine = pipeline._get_destination_clients(pipeline.state)[0].sql_client()._engine",
        "    _pt_stmts = [",
        stmtLines,
        "    ]",
        "    with _pt_engine.begin() as _pt_conn:",
        "        for _pt_stmt in _pt_stmts:",
        "            _pt_conn.execute(sqlalchemy.text(_pt_stmt))",
        "except Exception as _comp_sql_err:",
        '    print(f"[component SQL] warning: {_comp_sql_err}")'
      );
    }

    const merged = [existingCode, ...pyParts].filter(Boolean).join("\n\n");
    config.post_transform = { type: "python", code: merged };
  } else if (sqlStatements.length) {
    const existing = config.post_transform;
    const existingCode =
      existing &&
      typeof existing === "object" &&
      String((existing as Record<string, unknown>).type) === "sql"
        ? String((existing as Record<string, unknown>).code ?? "")
        : "";
    config.post_transform = {
      type: "sql",
      code: [existingCode.trim(), ...sqlStatements].filter(Boolean).join(";\n\n"),
    };
  }

  if (testLines.length) {
    const existing = Array.isArray(config.elt_tests)
      ? (config.elt_tests as string[])
      : typeof config.elt_tests === "string"
        ? config.elt_tests.split("\n").map((l) => l.trim()).filter(Boolean)
        : [];
    config.elt_tests = Array.from(new Set([...existing, ...testLines]));
  }

  if (quality.length) {
    const existing = Array.isArray(config.elt_quality) ? [...(config.elt_quality as unknown[])] : [];
    config.elt_quality = [...existing, ...quality];
  }

  if (compiled) {
    config.elt_components_compiled = true;
    config.elt_components_compiled_at = new Date().toISOString();
  }
}
