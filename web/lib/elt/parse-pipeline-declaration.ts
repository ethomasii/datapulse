import YAML from "yaml";
import { createPipelineBodySchema, type CreatePipelineBody } from "@/lib/elt/types";
import {
  DECLARATIVE_PIPELINE_SPEC_VERSION,
  declarativePipelineSpecSchema,
} from "@/lib/elt/declarative-pipeline-spec";
import { compileDeclarativePipelineSpec } from "@/lib/elt/compile-declarative-pipeline";

const DECLARATION_V1_KEY = "eltpulse_pipeline_declaration";
const SPEC_V2_KEY = "eltpulse_pipeline";
const UPSERT_KEY = "upsert";
const PIPELINE_KEY = "pipeline";

export type ParsedPipelineDeclaration = {
  body: CreatePipelineBody;
  /** When true, create or update by `name` + resolved tool. */
  upsert: boolean;
  specVersion: 1 | 2;
  /** Original YAML for v2 round-trip when applying declarative specs. */
  declarativeSpecYaml?: string;
};

function readUpsert(merged: Record<string, unknown>): boolean {
  const upsertRaw = merged[UPSERT_KEY];
  delete merged[UPSERT_KEY];
  return upsertRaw === true || upsertRaw === "true" || upsertRaw === 1;
}

function flattenDoc(raw: unknown): { merged: Record<string, unknown>; upsert: boolean; version: 1 | 2 } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Declaration must be a YAML mapping");
  }
  const root = raw as Record<string, unknown>;

  const v2 = root[SPEC_V2_KEY];
  const v1 = root[DECLARATION_V1_KEY];

  let version: 1 | 2;
  if (v2 === 2 || v2 === "2") {
    version = 2;
  } else if (v1 === 1 || v1 === "1") {
    version = 1;
  } else {
    throw new Error(`${SPEC_V2_KEY}: 2 or ${DECLARATION_V1_KEY}: 1 required`);
  }

  let merged: Record<string, unknown> = { ...root };
  const nested = root[PIPELINE_KEY];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    merged = { ...merged, ...(nested as Record<string, unknown>) };
  }
  delete merged[SPEC_V2_KEY];
  delete merged[DECLARATION_V1_KEY];
  delete merged[PIPELINE_KEY];

  const upsert = readUpsert(merged);
  return { merged, upsert, version };
}

/**
 * Parse eltPulse pipeline declaration YAML v1 (legacy flat keys).
 * For v2 declarative specs use {@link parseAndCompileDeclarativeYaml}.
 */
export function parsePipelineDeclarationYaml(yamlText: string): ParsedPipelineDeclaration {
  let doc: unknown;
  try {
    doc = YAML.parse(yamlText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid YAML: ${msg}`);
  }

  const { merged, upsert, version } = flattenDoc(doc);

  if (version === DECLARATIVE_PIPELINE_SPEC_VERSION) {
    throw new Error("Declarative pipeline spec v2 requires compile — use parseAndCompileDeclarativeYaml");
  }

  const parsed = createPipelineBodySchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(`Invalid pipeline declaration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }

  return { body: parsed.data, upsert, specVersion: 1 };
}

/** Parse v1 or v2 YAML; v2 compiles to CreatePipelineBody and resolves `@workspace`. */
export async function parseAndCompileDeclarativeYaml(
  userId: string,
  yamlText: string
): Promise<ParsedPipelineDeclaration> {
  let doc: unknown;
  try {
    doc = YAML.parse(yamlText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid YAML: ${msg}`);
  }

  const { merged, upsert, version } = flattenDoc(doc);

  if (version === DECLARATIVE_PIPELINE_SPEC_VERSION) {
    const specParsed = declarativePipelineSpecSchema.safeParse(merged);
    if (!specParsed.success) {
      throw new Error(
        `Invalid declarative pipeline spec: ${JSON.stringify(specParsed.error.flatten().fieldErrors)}`
      );
    }

    const compiled = await compileDeclarativePipelineSpec(userId, specParsed.data);
    if (!compiled.ok) {
      throw new Error(compiled.error);
    }

    return {
      body: compiled.body,
      upsert,
      specVersion: 2,
      declarativeSpecYaml: yamlText.trimEnd() + "\n",
    };
  }

  const parsed = createPipelineBodySchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(`Invalid pipeline declaration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }

  return { body: parsed.data, upsert, specVersion: 1 };
}
