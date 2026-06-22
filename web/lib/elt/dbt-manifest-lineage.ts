/**
 * Parse dbt manifest.json parent_map into model → parent short names for lineage UI.
 */

export type ColumnLineageRef = {
  model?: string;
  column?: string;
  source?: string;
};

/** model name → column name → upstream refs */
export type ModelColumnLineageMap = Record<string, Record<string, ColumnLineageRef[]>>;

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

function parseColumnNodeId(id: string): { model: string; column: string } | null {
  if (!id.startsWith("column.model.")) return null;
  const parts = id.split(".");
  if (parts.length < 5) return null;
  return { model: parts[parts.length - 2]!, column: parts[parts.length - 1]! };
}

function parseSourceColumnNodeId(id: string): { source: string; table: string; column: string } | null {
  if (!id.startsWith("column.source.")) return null;
  const parts = id.split(".");
  if (parts.length < 6) return null;
  return {
    source: parts[parts.length - 3]!,
    table: parts[parts.length - 2]!,
    column: parts[parts.length - 1]!,
  };
}

function parentToColumnRef(parentId: string): ColumnLineageRef | null {
  const col = parseColumnNodeId(parentId);
  if (col) return { model: col.model, column: col.column };
  const src = parseSourceColumnNodeId(parentId);
  if (src) return { source: `${src.source}.${src.table}`, column: src.column };
  if (parentId.startsWith("model.")) return { model: shortNodeName(parentId) };
  if (parentId.startsWith("source.")) return { source: shortNodeName(parentId) };
  return null;
}

/** Parse column-level lineage from manifest parent_map (column.* nodes). */
export function parseDbtManifestColumnLineage(manifestRaw: unknown): ModelColumnLineageMap {
  const out: ModelColumnLineageMap = {};
  if (!manifestRaw || typeof manifestRaw !== "object" || Array.isArray(manifestRaw)) return out;

  const raw = manifestRaw as {
    parent_map?: Record<string, string[]>;
    nodes?: Record<string, { depends_on?: { nodes?: string[] } }>;
  };

  const addEntry = (childId: string, parents: string[]) => {
    const child = parseColumnNodeId(childId);
    if (!child) return;
    const refs: ColumnLineageRef[] = [];
    for (const p of parents) {
      const ref = parentToColumnRef(p);
      if (ref) refs.push(ref);
    }
    if (!refs.length) return;
    if (!out[child.model]) out[child.model] = {};
    out[child.model][child.column] = refs;
  };

  if (raw.parent_map && typeof raw.parent_map === "object") {
    for (const [nodeId, parents] of Object.entries(raw.parent_map)) {
      if (nodeId.startsWith("column.")) addEntry(nodeId, parents ?? []);
    }
    if (Object.keys(out).length > 0) return out;
  }

  if (raw.nodes && typeof raw.nodes === "object") {
    for (const [nodeId, node] of Object.entries(raw.nodes)) {
      if (!nodeId.startsWith("column.")) continue;
      addEntry(nodeId, node.depends_on?.nodes ?? []);
    }
  }

  return out;
}

export function columnLineageForModel(
  columnLineage: ModelColumnLineageMap | undefined,
  modelName: string
): Record<string, ColumnLineageRef[]> | undefined {
  if (!columnLineage) return undefined;
  const exact = columnLineage[modelName];
  if (exact) return exact;
  const q = modelName.toLowerCase();
  const key = Object.keys(columnLineage).find((k) => k.toLowerCase() === q);
  return key ? columnLineage[key] : undefined;
}
