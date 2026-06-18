/**
 * Canonical layout for managed eltPulse repositories (your GitHub org).
 * Declarative pipeline YAML can be applied with `POST /api/elt/pipelines/declaration` (same schema as the JSON API).
 */
export const ELTPULSE_REPO = {
  root: "eltpulse",
  pipelinesDir: "eltpulse/pipelines",
  monitorsDir: "eltpulse/monitors",
  definitionsDir: "eltpulse/definitions",
  workspaceFile: "eltpulse_workspace.yaml",
  pipelineConfigFile: "config.yaml",
  /** User-visible label for the primary sync runner file */
  syncRunnerFile: "sync.elp",
  /** Default folder in a Git repo for dbt project files */
  dbtDir: "eltpulse/dbt",
} as const;

/** Repo-relative path for a named dbt project (not a local filesystem path). */
export function defaultDbtRepoSubpath(projectName: string): string {
  return `${ELTPULSE_REPO.dbtDir}/${pipelineModuleSegment(projectName)}`;
}

/** Safe segment for Python import paths derived from pipeline name */
export function pipelineModuleSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[0-9]/, "_$&");
}
