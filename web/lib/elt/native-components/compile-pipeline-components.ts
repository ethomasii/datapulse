import type { PipelineComponentSpec } from "@/lib/elt/declarative-pipeline-spec";
import { resolveComponentCompiler } from "@/lib/elt/component-packages";
import { getNativeComponent, resolveNativeComponentId } from "./registry";
import { resetMcpPreambleFlagForTests } from "./mcp-python-runtime";
import { hydrateComponentMcpConfig, loadMcpServersForCompile } from "@/lib/elt/mcp-server/resolve";
import type { CompiledPipelineComponents } from "./types";

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
  const testLines: string[] = [];
  const quality: CompiledPipelineComponents["quality"] = [];
  const warnings: string[] = [];
  let compiled = false;

  for (const comp of components) {
    const cfg = { ...(comp.config ?? {}), template_id: comp.config?.template_id ?? comp.id };
    const nativeId = resolveNativeComponentId(cfg) ?? comp.id;
    const native = getNativeComponent(nativeId);
    if (!native) {
      warnings.push(`No native compiler for component '${nativeId}' — stored in spec only`);
      continue;
    }

    const out = native.compile(cfg);
    applyCompileOutput(config, out, { pythonBlocks, sqlStatements, testLines, quality, warnings });
    compiled = true;
  }

  finalizeCompiledConfig(config, { pythonBlocks, sqlStatements, testLines, quality, compiled });
  return {
    config,
    result: { pythonBlocks, sqlStatements, testLines, quality, warnings, compiled },
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
  const testLines: string[] = [];
  const quality: CompiledPipelineComponents["quality"] = [];
  const warnings: string[] = [];
  let compiled = false;

  for (const comp of components) {
    let cfg: Record<string, unknown> = {
      ...(comp.config ?? {}),
      template_id: comp.config?.template_id ?? comp.id,
    };
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
      applyCompileOutput(config, out, { pythonBlocks, sqlStatements, testLines, quality, warnings });
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

  finalizeCompiledConfig(config, { pythonBlocks, sqlStatements, testLines, quality, compiled });
  return {
    config,
    result: { pythonBlocks, sqlStatements, testLines, quality, warnings, compiled },
  };
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
  if (out.sql?.length) acc.sqlStatements.push(...out.sql);
  if (out.tests?.length) acc.testLines.push(...out.tests);
  if (out.quality?.length) acc.quality.push(...out.quality);
  if (out.configPatch && Object.keys(out.configPatch).length) {
    mergeConfigPatch(config, out.configPatch);
  }
  if (out.warnings?.length) acc.warnings.push(...out.warnings);
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
