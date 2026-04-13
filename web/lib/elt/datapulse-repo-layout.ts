/**
 * Canonical layout for managed eltPulse repositories (your GitHub org).
 */
export const DATAPULSE_REPO = {
  root: "datapulse",
  pipelinesDir: "datapulse/pipelines",
  definitionsDir: "datapulse/definitions",
  workspaceFile: "datapulse_workspace.yaml",
  pipelineConfigFile: "config.yaml",
  /** User-visible label for the primary sync runner file */
  syncRunnerFile: "sync.dp",
} as const;

/** Safe segment for Python import paths derived from pipeline name */
export function pipelineModuleSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[0-9]/, "_$&");
}
