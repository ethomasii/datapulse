import type { PipelineComponentSpec } from "@/lib/elt/declarative-pipeline-spec";

/** Normalize table or asset reference for spec + DAG display. */
export function normalizeAssetKey(ref: string): string {
  return ref.trim().replace(/\s+/g, "_");
}

/** Derive canonical output asset key for a pipeline step. */
export function deriveStepAssetKey(
  pipelineName: string,
  stepId: string,
  config: Record<string, unknown>
): string {
  const explicit = String(config.asset_key ?? config.output_asset_key ?? "").trim();
  if (explicit) return normalizeAssetKey(explicit);

  const table = String(
    config.output_table ?? config.asset_name ?? config.table_name ?? config.table ?? ""
  ).trim();
  if (table) return normalizeAssetKey(table);

  return normalizeAssetKey(`${pipelineName}.${stepId}`);
}

/** Resolve input asset keys from config fields and upstream step outputs. */
export function resolveStepInputAssetKeys(
  config: Record<string, unknown>,
  upstreamOutputByStepId: Map<string, string>
): string[] {
  const fromSpec = config.input_asset_keys ?? config.inputs;
  if (Array.isArray(fromSpec)) {
    return fromSpec.map(String).map(normalizeAssetKey).filter(Boolean);
  }

  const refs: string[] = [];
  const left = String(config.left_asset_key ?? config.left_table ?? "").trim();
  const right = String(config.right_asset_key ?? config.right_table ?? "").trim();
  const table = String(config.table ?? config.input_table ?? "").trim();
  if (left) refs.push(normalizeAssetKey(left));
  if (right) refs.push(normalizeAssetKey(right));
  if (table && !refs.length) refs.push(normalizeAssetKey(table));

  for (const dep of config._after_asset_keys as string[] | undefined ?? []) {
    const u = upstreamOutputByStepId.get(dep);
    if (u && !refs.includes(u)) refs.push(u);
  }
  return refs;
}

/** Attach assetKey + inputs to a component spec from config and upstream map. */
export function enrichComponentSpecAssets(
  spec: PipelineComponentSpec,
  pipelineName: string,
  upstreamOutputByStepId: Map<string, string>
): PipelineComponentSpec {
  const cfg = { ...(spec.config ?? {}) } as Record<string, unknown>;
  const assetKey = spec.assetKey ?? deriveStepAssetKey(pipelineName, spec.id, cfg);
  const inputFromAfter = (spec.after ?? [])
    .map((dep) => upstreamOutputByStepId.get(dep))
    .filter((x): x is string => Boolean(x));
  const fromConfig = resolveStepInputAssetKeys(cfg, upstreamOutputByStepId);
  const inputs = spec.inputs ?? [...fromConfig, ...inputFromAfter].filter((v, i, a) => a.indexOf(v) === i);

  return {
    ...spec,
    assetKey,
    ...(inputs.length ? { inputs } : {}),
    config: {
      ...cfg,
      asset_key: assetKey,
      ...(inputs.length ? { input_asset_keys: inputs } : {}),
    },
  };
}

/** Enrich ordered component list with asset keys chained by `after` deps. */
export function enrichComponentListAssets(
  pipelineName: string,
  components: PipelineComponentSpec[]
): PipelineComponentSpec[] {
  const outputById = new Map<string, string>();
  return components.map((c) => {
    const enriched = enrichComponentSpecAssets(c, pipelineName, outputById);
    if (enriched.assetKey) outputById.set(c.id, enriched.assetKey);
    return enriched;
  });
}

/** Warehouse table ref for read-only preview from step config. */
export function previewTableFromConfig(config: Record<string, unknown>): string | null {
  const table = String(
    config.output_table ??
      config.table ??
      config.left_table ??
      config.right_table ??
      config.asset_key ??
      ""
  ).trim();
  return table || null;
}

/** Upstream / input table for Lakeflow-style input preview. */
export function inputTableFromConfig(config: Record<string, unknown>): string | null {
  const table = String(
    config.input_table ?? config.table ?? config.left_table ?? config.source_table ?? ""
  ).trim();
  return table || null;
}
