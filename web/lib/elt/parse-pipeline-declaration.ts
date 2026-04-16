import YAML from "yaml";
import { createPipelineBodySchema, type CreatePipelineBody } from "@/lib/elt/types";

const DECLARATION_KEY = "eltpulse_pipeline_declaration";
const UPSERT_KEY = "upsert";
const PIPELINE_KEY = "pipeline";

export type ParsedPipelineDeclaration = {
  body: CreatePipelineBody;
  /** When true, create or update by `name` + resolved tool (same as `POST .../declaration?mode=upsert`). */
  upsert: boolean;
};

function flattenDeclarationDoc(raw: unknown): { json: Record<string, unknown>; upsert: boolean } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Declaration must be a YAML mapping");
  }
  const root = raw as Record<string, unknown>;
  const ver = root[DECLARATION_KEY];
  if (ver !== 1 && ver !== "1") {
    throw new Error(`${DECLARATION_KEY} must be 1`);
  }

  let merged: Record<string, unknown> = { ...root };
  const nested = root[PIPELINE_KEY];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    merged = { ...merged, ...(nested as Record<string, unknown>) };
  }
  delete merged[DECLARATION_KEY];
  delete merged[PIPELINE_KEY];

  const upsertRaw = merged[UPSERT_KEY];
  delete merged[UPSERT_KEY];
  const upsert = upsertRaw === true || upsertRaw === "true" || upsertRaw === 1;

  return { json: merged, upsert };
}

/**
 * Parse eltPulse pipeline declaration YAML (v1) into the same shape as `POST /api/elt/pipelines` JSON.
 *
 * Supports either flat keys or a nested `pipeline:` mapping. Optional `upsert: true` merges with
 * {@link ParsedPipelineDeclaration.upsert}.
 */
export function parsePipelineDeclarationYaml(yamlText: string): ParsedPipelineDeclaration {
  let doc: unknown;
  try {
    doc = YAML.parse(yamlText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid YAML: ${msg}`);
  }

  const { json: flat, upsert } = flattenDeclarationDoc(doc);

  const parsed = createPipelineBodySchema.safeParse(flat);
  if (!parsed.success) {
    const err = parsed.error.flatten();
    throw new Error(`Invalid pipeline declaration: ${JSON.stringify(err.fieldErrors)}`);
  }

  return { body: parsed.data, upsert };
}
