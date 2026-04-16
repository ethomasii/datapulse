import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { parsePipelineDeclarationYaml } from "@/lib/elt/parse-pipeline-declaration";
import { createPipelineDefinition, upsertPipelineDefinition } from "@/lib/elt/persist-pipeline";

/**
 * POST /api/elt/pipelines/declaration
 *
 * Apply a pipeline from **declarative YAML** (GitOps-friendly). Same fields as `POST /api/elt/pipelines` JSON.
 *
 * - Body: raw YAML with `Content-Type: application/yaml` or `text/yaml`, **or** JSON `{ "declaration": "<yaml string>" }`.
 * - Query: `mode=upsert` forces create-or-replace by `name` + resolved tool. Otherwise use `upsert: true` in YAML.
 *
 * @example
 * ```yaml
 * eltpulse_pipeline_declaration: 1
 * upsert: true
 * name: my_github_to_snowflake
 * sourceType: github
 * destinationType: snowflake
 * tool: auto
 * sourceConfiguration:
 *   repo_owner: myorg
 *   repo_name: myrepo
 * ```
 */
export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const modeParam = url.searchParams.get("mode");

  const ct = req.headers.get("content-type") ?? "";
  let yamlText: string;
  if (ct.includes("yaml") || ct.includes("x-yaml")) {
    yamlText = await req.text();
  } else {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Expected YAML body or JSON { declaration }" }, { status: 400 });
    }
    if (
      json &&
      typeof json === "object" &&
      !Array.isArray(json) &&
      typeof (json as Record<string, unknown>).declaration === "string"
    ) {
      yamlText = String((json as Record<string, unknown>).declaration);
    } else {
      return NextResponse.json(
        { error: 'Send Content-Type: application/yaml with raw YAML, or JSON: { "declaration": "..." }' },
        { status: 400 }
      );
    }
  }

  let parsed: ReturnType<typeof parsePipelineDeclarationYaml>;
  try {
    parsed = parsePipelineDeclarationYaml(yamlText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const wantUpsert = modeParam === "upsert" || parsed.upsert;

  try {
    const result = wantUpsert
      ? await upsertPipelineDefinition(user.id, parsed.body)
      : await createPipelineDefinition(user.id, parsed.body);

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return NextResponse.json(
      { pipeline: result.pipeline, created: result.created },
      { status: result.created ? 201 : 200 }
    );
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
