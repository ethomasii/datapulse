/**
 * Parse dbt manifest.json parent_map into model → parent short names for lineage UI.
 */

/** Extract model dependencies from dbt manifest parent_map (or node depends_on). */
export function parseDbtManifestDependencies(manifestRaw: unknown): Record<string, string[]> {
  if (!manifestRaw || typeof manifestRaw !== "object" || Array.isArray(manifestRaw)) return {};

  const raw = manifestRaw as {
    parent_map?: Record<string, string[]>;
    nodes?: Record<string, { depends_on?: { nodes?: string[] }; name?: string }>;
  };

  const out: Record<string, string[]> = {};

  if (raw.parent_map && typeof raw.parent_map === "object") {
    for (const [nodeId, parents] of Object.entries(raw.parent_map)) {
      if (!nodeId.startsWith("model.")) continue;
      const modelName = shortNodeName(nodeId);
      if (!modelName) continue;
      out[modelName] = (parents ?? []).map(shortNodeName).filter(Boolean);
    }
    if (Object.keys(out).length > 0) return out;
  }

  if (raw.nodes && typeof raw.nodes === "object") {
    for (const [nodeId, node] of Object.entries(raw.nodes)) {
      if (!nodeId.startsWith("model.")) continue;
      const modelName = node.name ?? shortNodeName(nodeId);
      if (!modelName) continue;
      const parents = node.depends_on?.nodes ?? [];
      out[modelName] = parents.map(shortNodeName).filter(Boolean);
    }
  }

  return out;
}

function shortNodeName(uniqueId: string): string {
  const parts = uniqueId.split(".");
  return parts[parts.length - 1]?.trim() ?? uniqueId;
}
