import type { DbtHubPackage } from "@/lib/elt/dbt-hub-packages";
import { pipelineModuleSegment } from "@/lib/elt/eltpulse-repo-layout";

export type DbtScaffoldFile = { path: string; content: string };

/** Files to commit under `eltpulse/dbt/{pipelineName}/` when scaffolding from a hub package. */
export function generateDbtScaffoldFiles(
  pipelineName: string,
  hubPackage: DbtHubPackage
): DbtScaffoldFile[] {
  const mod = pipelineModuleSegment(pipelineName);
  const base = `eltpulse/dbt/${mod}`;

  const dbtProject = `name: '${mod}_dbt'
version: '1.0.0'
config-version: 2

profile: '${mod}_dbt'

model-paths: ["models"]
analysis-paths: ["analyses"]
test-paths: ["tests"]
seed-paths: ["seeds"]
macro-paths: ["macros"]
snapshot-paths: ["snapshots"]

models:
  ${mod}_dbt:
    +materialized: view
`;

  const packagesYml = `packages:
  - package: ${hubPackage.package}
    version: "${hubPackage.version}"
`;

  const readme = `# ${pipelineName} dbt project

Scaffolded by eltPulse for source **${hubPackage.sourceKey}**.

- Hub package: \`${hubPackage.package}\`
- Docs: ${hubPackage.docsUrl}

After load, eltPulse runs dbt via [dlt's dbt runner](https://dlthub.com/docs/dlt-ecosystem/transformations/dbt).
Set pipeline \`dlt_dbt.package_path\` to \`./${base}\` or this folder in your repo.
`;

  return [
    { path: `${base}/dbt_project.yml`, content: dbtProject },
    { path: `${base}/packages.yml`, content: packagesYml },
    { path: `${base}/models/.gitkeep`, content: "" },
    { path: `${base}/README.md`, content: readme },
  ];
}

/** Relative package_path for codegen when scaffold lives in managed repo layout. */
export function scaffoldPackagePathForPipeline(pipelineName: string): string {
  return `./eltpulse/dbt/${pipelineModuleSegment(pipelineName)}`;
}
