/**
 * Infer a native warehouse transform from before/after examples (table or screenshot).
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getNativeComponent } from "@/lib/elt/native-components/registry";
import { getAnthropic } from "@/lib/ai/anthropic";

export type TransformExampleInput = {
  inputTable: string;
  inputColumns: string[];
  inputSampleRows: Record<string, unknown>[];
  /** Target rows pasted by user (table-only mode). */
  outputExampleRows?: Record<string, unknown>[];
  /** Natural language description of desired output. */
  outputDescription?: string;
  /** Base64 image (screenshot mode). */
  imageBase64?: string;
  imageMediaType?: string;
};

export type InferredTransformStep = {
  component_id: string;
  label: string;
  config: Record<string, unknown>;
  explanation: string;
};

const ALLOWED_COMPONENTS = [
  "filter_rows",
  "select_columns",
  "sort_rows",
  "group_aggregate",
  "join_tables",
  "union_tables",
  "drop_duplicates",
  "rename_columns",
  "cast_columns",
  "add_column_expr",
  "pivot",
  "limit_rows",
  "sample_rows",
  "data_cleansing",
  "fill_nulls",
  "replace_values",
] as const;

function rowsToMarkdownTable(rows: Record<string, unknown>[], columns?: string[]): string {
  if (!rows.length) return "(empty)";
  const cols =
    columns?.length ? columns : Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const header = `| ${cols.join(" | ")} |`;
  const sep = `| ${cols.map(() => "---").join(" | ")} |`;
  const body = rows
    .slice(0, 8)
    .map((r) => `| ${cols.map((c) => String(r[c] ?? "")).join(" | ")} |`)
    .join("\n");
  return [header, sep, body].join("\n");
}

export async function inferTransformFromExample(
  input: TransformExampleInput
): Promise<InferredTransformStep> {
  const anthropic = getAnthropic();
  if (!anthropic) {
    throw new Error("Transform by example requires ANTHROPIC_API_KEY on the server.");
  }

  const system = `You infer ONE eltPulse native warehouse transform step from input/output examples.
Return ONLY valid JSON (no markdown):
{
  "component_id": "<one of: ${ALLOWED_COMPONENTS.join(", ")}>",
  "label": "<short canvas label>",
  "config": { ...native component fields... },
  "explanation": "<one sentence>"
}

Rules:
- config must include "table" set to the input table ref provided.
- For filter_rows use "condition" (SQL WHERE fragment).
- For group_aggregate use "group_by" (array) and "aggregations" (object col→fn).
- For select_columns use "columns" (array).
- For join_tables include left_table, right_table, on, how, output_table when inferring joins.
- Always set output_table to a sensible schema.table under the same schema as input.
- Pick the simplest single step that explains the transformation.`;

  const userParts: Anthropic.MessageParam["content"] = [];

  userParts.push({
    type: "text",
    text: [
      `Input table: ${input.inputTable}`,
      "",
      "Input columns:",
      input.inputColumns.join(", ") || "(unknown)",
      "",
      "Input sample:",
      rowsToMarkdownTable(input.inputSampleRows, input.inputColumns),
      "",
      input.outputExampleRows?.length
        ? `Desired output sample:\n${rowsToMarkdownTable(input.outputExampleRows)}`
        : "",
      input.outputDescription?.trim()
        ? `Desired output (description): ${input.outputDescription.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (input.imageBase64 && input.imageMediaType) {
    userParts.push({
      type: "image",
      source: {
        type: "base64",
        media_type: input.imageMediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: input.imageBase64,
      },
    });
    userParts.push({
      type: "text",
      text: "The image shows the desired output shape or a screenshot of target data. Infer the transform.",
    });
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    system,
    messages: [{ role: "user", content: userParts }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Model did not return JSON for the inferred transform.");

  let parsed: InferredTransformStep;
  try {
    parsed = JSON.parse(jsonMatch[0]) as InferredTransformStep;
  } catch {
    throw new Error("Could not parse inferred transform JSON.");
  }

  const componentId = String(parsed.component_id ?? "").trim();
  if (!ALLOWED_COMPONENTS.includes(componentId as (typeof ALLOWED_COMPONENTS)[number])) {
    throw new Error(`Unsupported inferred component: ${componentId || "(empty)"}`);
  }

  const native = getNativeComponent(componentId);
  if (!native) throw new Error(`Unknown component: ${componentId}`);

  const config: Record<string, unknown> = {
    ...(parsed.config ?? {}),
    template_id: componentId,
    table: String(parsed.config?.table ?? input.inputTable),
  };

  if (!config.output_table) {
    const parts = input.inputTable.split(".");
    const schema = parts.length > 1 ? parts[0]! : "gold";
    const base = parts.length > 1 ? parts.slice(1).join("_") : parts[0]!;
    config.output_table = `${schema}.${base}_${componentId.replace(/[^a-z0-9_]/gi, "_")}`;
  }

  return {
    component_id: componentId,
    label: String(parsed.label ?? native.name).slice(0, 64),
    config,
    explanation: String(parsed.explanation ?? `Inferred ${native.name} step.`),
  };
}
