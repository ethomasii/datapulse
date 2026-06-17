import { db } from "@/lib/db/client";
import { createPipelineDefinition } from "@/lib/elt/persist-pipeline";
import { minimalSourceConfigurationForNewPipeline } from "@/lib/elt/minimal-source-configuration";

const DEMO_PIPELINE_NAME = "demo_github_to_duckdb";

/**
 * Seeds a sample pipeline for new users so the builder and runs UI are not empty.
 * Idempotent — skips when the user already has any pipeline.
 */
export async function seedDemoWorkspaceIfEmpty(userId: string): Promise<{
  seeded: boolean;
  pipelineId?: string;
}> {
  const count = await db.eltPipeline.count({ where: { userId } });
  if (count > 0) return { seeded: false };

  try {
    const result = await createPipelineDefinition(userId, {
      name: DEMO_PIPELINE_NAME,
      sourceType: "github",
      destinationType: "duckdb",
      tool: "auto",
      description:
        "Sample pipeline — connect your GitHub token, then run to sync issues and pull requests into DuckDB.",
      sourceConfiguration: minimalSourceConfigurationForNewPipeline("github"),
    });
    if (!result.ok) return { seeded: false };
    return { seeded: true, pipelineId: result.pipeline.id };
  } catch {
    return { seeded: false };
  }
}
