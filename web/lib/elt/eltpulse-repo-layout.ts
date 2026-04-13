/**
 * Canonical layout for managed eltPulse repositories (your GitHub org).
 */
export const ELTPULSE_REPO = {
  root: "eltpulse",
  pipelinesDir: "eltpulse/pipelines",
  definitionsDir: "eltpulse/definitions",
  workspaceFile: "eltpulse_workspace.yaml",
  pipelineConfigFile: "config.yaml",
  /** User-visible label for the primary sync runner file */
  syncRunnerFile: "sync.elp",
} as const;

/** Safe segment for Python import paths derived from pipeline name */
export function pipelineModuleSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[0-9]/, "_$&");
}
