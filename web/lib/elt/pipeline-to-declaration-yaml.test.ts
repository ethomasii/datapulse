import { describe, expect, it } from "vitest";
import type { EltPipeline } from "@prisma/client";
import { eltPipelineRowToCreateBody, eltPipelineToDeclarationYamlString } from "./pipeline-to-declaration-yaml";
import { parsePipelineDeclarationYaml } from "./parse-pipeline-declaration";

describe("pipeline-to-declaration-yaml", () => {
  it("round-trips a minimal pipeline row through declaration YAML", () => {
    const row = {
      id: "p1",
      userId: "u1",
      name: "github_to_duckdb",
      tool: "dlt",
      enabled: true,
      sourceType: "github",
      destinationType: "duckdb",
      description: null,
      groupName: null,
      sourceConfiguration: { repo_owner: "o", repo_name: "r", resources: "issues" },
      pipelineCode: "",
      configYaml: null,
      workspaceYaml: null,
      runsWebhookUrl: null,
      defaultTargetAgentTokenId: null,
      executionHost: "inherit",
      sourceConnectionId: null,
      destinationConnectionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as EltPipeline;

    const body = eltPipelineRowToCreateBody(row);
    expect(body.name).toBe("github_to_duckdb");
    expect(body.tool).toBe("auto");
    expect(body.sourceConfiguration).toMatchObject({ repo_owner: "o", repo_name: "r" });

    const yaml = eltPipelineToDeclarationYamlString(row);
    const parsed = parsePipelineDeclarationYaml(yaml);
    expect(parsed.body.name).toBe("github_to_duckdb");
    expect(parsed.upsert).toBe(true);
  });
});
