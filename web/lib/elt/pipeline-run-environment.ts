import { z } from "zod";

/** Environments that resolve deployment connection bindings for pipeline runs. */
export const PIPELINE_RUN_ENVIRONMENTS = ["development", "production"] as const;

export type PipelineRunEnvironment = (typeof PIPELINE_RUN_ENVIRONMENTS)[number];

export const DEFAULT_PIPELINE_RUN_ENVIRONMENT: PipelineRunEnvironment = "development";

export const pipelineRunEnvironmentSchema = z
  .enum(PIPELINE_RUN_ENVIRONMENTS)
  .default(DEFAULT_PIPELINE_RUN_ENVIRONMENT);

/** Map legacy aliases; unknown values fall back to development. */
export function normalizePipelineRunEnvironment(raw?: string | null): PipelineRunEnvironment {
  const s = raw?.trim().toLowerCase();
  if (s === "production" || s === "prod") return "production";
  if (s === "development" || s === "dev" || s === "default" || s === "webhook") return "development";
  if (PIPELINE_RUN_ENVIRONMENTS.includes(s as PipelineRunEnvironment)) {
    return s as PipelineRunEnvironment;
  }
  return DEFAULT_PIPELINE_RUN_ENVIRONMENT;
}
