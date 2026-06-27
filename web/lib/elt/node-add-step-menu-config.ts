/** Lakeflow-style quick picks for the node + menu. */

export type NodeAddStepQuickPick = {
  componentId: string;
  label: string;
  hint?: string;
};

export type NodeAddStepSection = {
  id: string;
  label: string;
  items: NodeAddStepQuickPick[];
};

export const NODE_ADD_STEP_SECTIONS: NodeAddStepSection[] = [
  {
    id: "combine",
    label: "Combine",
    items: [
      { componentId: "join_tables", label: "Join", hint: "Enrich with another table" },
      { componentId: "union_tables", label: "Union", hint: "Stack compatible tables" },
      { componentId: "semi_join", label: "Semi join", hint: "Keep rows with a match" },
    ],
  },
  {
    id: "filter",
    label: "Filter & shape",
    items: [
      { componentId: "filter_rows", label: "Filter", hint: "Keep rows matching a condition" },
      { componentId: "select_columns", label: "Select columns", hint: "Project a subset" },
      { componentId: "sort_rows", label: "Sort", hint: "Order rows" },
      { componentId: "sample_rows", label: "Sample", hint: "Random or head sample" },
    ],
  },
  {
    id: "aggregate",
    label: "Aggregate",
    items: [
      { componentId: "group_aggregate", label: "Group & aggregate", hint: "SUM, COUNT, AVG by key" },
      { componentId: "pivot", label: "Pivot", hint: "Wide format from keys" },
      { componentId: "rank", label: "Rank", hint: "Row number within groups" },
    ],
  },
  {
    id: "clean",
    label: "Clean",
    items: [
      { componentId: "drop_duplicates", label: "Dedupe", hint: "Distinct rows by key" },
      { componentId: "data_cleansing", label: "Cleanse", hint: "Trim, normalize, fix types" },
      { componentId: "fill_nulls", label: "Fill nulls", hint: "Default missing values" },
    ],
  },
];

export const NODE_ADD_AI_ACTIONS = [
  {
    id: "transform_by_example",
    label: "Transform by example",
    hint: "Paste target rows or a screenshot — infer the step",
  },
  {
    id: "extend_with_assistant",
    label: "Extend with Pulse AI",
    hint: "Describe the next step in plain English",
  },
] as const;

export type NodeAddAiActionId = (typeof NODE_ADD_AI_ACTIONS)[number]["id"];
