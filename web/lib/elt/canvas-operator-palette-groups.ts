import type { ComponentListItem } from "@/components/elt/component-palette";

export type CanvasOperatorPaletteGroup = {
  id: string;
  title: string;
  subtitle: string;
  /** Preferred order within the group (unknown ids append alphabetically). */
  ids: readonly string[];
};

/** Transform operators grouped by what they do on asset data. */
export const CANVAS_TRANSFORM_PALETTE_GROUPS: readonly CanvasOperatorPaletteGroup[] = [
  {
    id: "combine",
    title: "Combine tables",
    subtitle: "Join, union, and merge rowsets",
    ids: ["join_tables", "union_tables", "semi_join", "anti_join", "cross_join"],
  },
  {
    id: "filter_shape",
    title: "Filter & shape",
    subtitle: "Select, filter, sort, and route rows",
    ids: ["select_columns", "filter_rows", "sort_rows", "limit_rows", "sample_rows", "router"],
  },
  {
    id: "aggregate",
    title: "Aggregate & windows",
    subtitle: "Group, rank, running totals, and analytics",
    ids: [
      "group_aggregate",
      "pivot",
      "unpivot",
      "rank",
      "running_total",
      "top_n_per_group",
      "count_records",
      "weighted_average",
      "window_calculation",
      "pct_change",
    ],
  },
  {
    id: "clean",
    title: "Clean & quality prep",
    subtitle: "Dedupe, fill, replace, and validate",
    ids: [
      "drop_duplicates",
      "data_cleansing",
      "fill_nulls",
      "replace_values",
      "alter_row",
      "outlier_clipper",
      "data_masking",
      "schema_validator",
    ],
  },
  {
    id: "columns",
    title: "Columns & expressions",
    subtitle: "Rename, cast, and computed fields",
    ids: [
      "rename_columns",
      "cast_columns",
      "add_column_expr",
      "multi_row_formula",
      "hash",
      "audit_columns",
      "record_id",
    ],
  },
  {
    id: "reshape",
    title: "Reshape & nested data",
    subtitle: "Flatten JSON, split columns, encode categories",
    ids: [
      "transpose",
      "text_to_columns",
      "json_flatten",
      "nested_field_extractor",
      "array_exploder",
      "append_fields",
      "one_hot_encoding",
      "train_test_split",
    ],
  },
  {
    id: "parse",
    title: "Parse text & messages",
    subtitle: "HL7, FIX, email, HTML, XML, and regex",
    ids: [
      "hl7_v2_parser",
      "fix_message_parser",
      "email_parser",
      "regex_parser",
      "html_parser",
      "xml_parser",
      "datetime_parser",
    ],
  },
  {
    id: "modeling",
    title: "Slowly changing dimensions",
    subtitle: "SCD Type 1 and Type 2 historization",
    ids: ["scd_type_1", "scd_type_2"],
  },
  {
    id: "sql_code",
    title: "SQL & code",
    subtitle: "Custom warehouse SQL or Python when needed",
    ids: ["sql_transform"],
  },
];

export const CANVAS_MCP_TOOLS_GROUP: CanvasOperatorPaletteGroup = {
  id: "mcp_tools",
  title: "MCP tools",
  subtitle: "Deterministic calls from your workspace MCP servers",
  ids: [],
};

export const CANVAS_AI_PALETTE_GROUP: CanvasOperatorPaletteGroup = {
  id: "ai",
  title: "AI & MCP",
  subtitle: "LLM enrichment, agents, and tool calls on asset rows",
  ids: ["mcp_tool_call", "litellm_agent", "litellm_inference_asset", "llm_evaluator"],
};

const OTHER_TRANSFORMS_GROUP: CanvasOperatorPaletteGroup = {
  id: "other",
  title: "More transforms",
  subtitle: "Additional catalog operators",
  ids: [],
};

function sortByPreferredOrder(items: ComponentListItem[], preferredIds: readonly string[]): ComponentListItem[] {
  const rank = new Map(preferredIds.map((id, i) => [id, i]));
  return [...items].sort((a, b) => {
    const ra = rank.get(a.id) ?? 9999;
    const rb = rank.get(b.id) ?? 9999;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

/** One palette section with resolved catalog items. */
export type CanvasOperatorPaletteSection = CanvasOperatorPaletteGroup & {
  items: ComponentListItem[];
};

/** Bucket transform + AI catalog items into labeled palette sections. */
export function groupCanvasOperatorPalette(
  transformItems: ComponentListItem[],
  aiItems: ComponentListItem[]
): CanvasOperatorPaletteSection[] {
  const byId = new Map<string, ComponentListItem>();
  for (const item of transformItems) byId.set(item.id, item);

  const assigned = new Set<string>();
  const sections: CanvasOperatorPaletteSection[] = [];

  for (const group of CANVAS_TRANSFORM_PALETTE_GROUPS) {
    const items: ComponentListItem[] = [];
    for (const id of group.ids) {
      const item = byId.get(id);
      if (item) {
        items.push(item);
        assigned.add(id);
      }
    }
    for (const item of transformItems) {
      if (assigned.has(item.id)) continue;
      if (inferTransformGroupId(item) === group.id) {
        items.push(item);
        assigned.add(item.id);
      }
    }
    if (items.length) {
      sections.push({ ...group, items: sortByPreferredOrder(items, group.ids) });
    }
  }

  const unassigned = transformItems.filter((item) => !assigned.has(item.id));
  if (unassigned.length) {
    sections.push({
      ...OTHER_TRANSFORMS_GROUP,
      items: sortByPreferredOrder(unassigned, []),
    });
  }

  const aiById = new Map(aiItems.map((c) => [c.id, c]));
  const aiNative = aiItems.filter((c) => !c.isMcpVirtual);
  const mcpVirtual = aiItems.filter((c) => c.isMcpVirtual);
  const aiOrdered: ComponentListItem[] = [];
  for (const id of CANVAS_AI_PALETTE_GROUP.ids) {
    const item = aiById.get(id);
    if (item && !item.isMcpVirtual) aiOrdered.push(item);
  }
  for (const item of aiNative) {
    if (!aiOrdered.some((c) => c.id === item.id)) aiOrdered.push(item);
  }
  if (aiOrdered.length) {
    sections.push({ ...CANVAS_AI_PALETTE_GROUP, items: aiOrdered });
  }

  if (mcpVirtual.length) {
    sections.push({
      ...CANVAS_MCP_TOOLS_GROUP,
      items: [...mcpVirtual].sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  return sections;
}

function inferTransformGroupId(item: ComponentListItem): string | null {
  const id = item.id.toLowerCase();
  if (/join|union|semi_join|anti_join|cross_join/.test(id)) return "combine";
  if (/filter|select|sort|limit|sample|router/.test(id)) return "filter_shape";
  if (/pivot|unpivot|aggregate|group|rank|running|window|pct_change|weighted|count_records|top_n/.test(id)) {
    return "aggregate";
  }
  if (/duplicate|cleans|fill_null|replace|alter_row|outlier|mask|valid/.test(id)) return "clean";
  if (/rename|cast|column|formula|hash|audit|record_id/.test(id)) return "columns";
  if (/flatten|transpose|text_to|nested|array|append|one_hot|train_test|encode/.test(id)) return "reshape";
  if (/parser|parse|hl7|fix_message|email|regex|html|xml|datetime/.test(id)) return "parse";
  if (/scd/.test(id)) return "modeling";
  if (/sql/.test(id)) return "sql_code";
  return null;
}

/** Filter palette sections by search query (all sections, flat merge for display). */
export function filterCanvasOperatorPaletteSections(
  sections: CanvasOperatorPaletteSection[],
  query: string
): CanvasOperatorPaletteSection[] {
  const ql = query.trim().toLowerCase();
  if (!ql) return sections;

  const matches = (c: ComponentListItem) =>
    c.id.toLowerCase().includes(ql) ||
    c.name.toLowerCase().includes(ql) ||
    c.description.toLowerCase().includes(ql) ||
    c.compileHint.toLowerCase().includes(ql);

  const filtered = sections
    .map((section) => ({ ...section, items: section.items.filter(matches) }))
    .filter((section) => section.items.length > 0);

  if (filtered.length <= 1) return filtered;

  const merged = filtered.flatMap((s) => s.items);
  return [
    {
      id: "search",
      title: "Search results",
      subtitle: `${merged.length} match${merged.length === 1 ? "" : "es"}`,
      ids: [],
      items: merged,
    },
  ];
}
