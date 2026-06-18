import type { AssetTechnicalProfile } from "@/lib/elt/asset-technical-profile";
import type { ReadOnlyQueryResult } from "@/lib/elt/warehouse-readonly-query";
import type { PipelineAssetBundle, WorkspaceAsset } from "@/lib/elt/pipeline-assets";
import { syncModeLabel } from "@/lib/elt/pipeline-tool-labels";

export function buildAssetAiContextBlock(
  asset: WorkspaceAsset,
  bundle: PipelineAssetBundle,
  profile: AssetTechnicalProfile,
  extras?: {
    dataSample?: ReadOnlyQueryResult;
    glossaryTerms?: { term: string; definition: string; columnName?: string | null }[];
  }
): string {
  const siblings = [bundle.source, ...bundle.rawAssets, ...bundle.transforms, ...bundle.postTransforms]
    .filter((a) => a.id !== asset.id)
    .map((a) => `- ${a.kind}: ${a.displayName} (${a.id})`)
    .join("\n");

  const columnLines = profile.columns.slice(0, 80).map((c) => {
    const parts = [c.name];
    if (c.type) parts.push(`type=${c.type}`);
    if (c.description) parts.push(c.description);
    return `  - ${parts.join(" · ")}`;
  });

  const lines = [
    "## Asset",
    `- ID: ${asset.id}`,
    `- Kind: ${asset.kind}`,
    `- Display name: ${asset.catalogDisplayName ?? asset.displayName}`,
    `- Pipeline: ${bundle.pipelineName} (${bundle.pipelineId})`,
    `- Source → destination: ${bundle.sourceType} → ${bundle.destinationType}`,
    `- Sync mode: ${syncModeLabel(bundle.syncMode)}`,
    `- Landing: ${asset.landingQualified ?? asset.landingDataset ?? "unknown"}`,
    asset.catalogDescription ? `- Catalog description: ${asset.catalogDescription}` : "",
    profile.inferredDescription ? `- Inferred context: ${profile.inferredDescription}` : "",
    profile.dbtPackageDescription ? `- dbt package: ${profile.dbtPackageDescription}` : "",
    profile.configNotes ? `- Config notes: ${profile.configNotes}` : "",
    asset.catalogTags?.length ? `- Tags: ${asset.catalogTags.join(", ")}` : "",
    bundle.lastRun
      ? `- Last run: ${bundle.lastRun.status} at ${bundle.lastRun.finishedAt ?? bundle.lastRun.startedAt}`
      : "- Last run: none",
    columnLines.length ? `\n## Columns (${profile.columns.length})\n${columnLines.join("\n")}` : "\n## Columns\n(none known — suggest running a pipeline and warehouse verify)",
    extras?.glossaryTerms?.length
      ? `\n## Glossary\n${extras.glossaryTerms.map((g) => `- **${g.term}**${g.columnName ? ` (${g.columnName})` : ""}: ${g.definition}`).join("\n")}`
      : "",
    extras?.dataSample?.ok && extras.dataSample.rows.length
      ? `\n## Data sample (${extras.dataSample.rows.length} rows)\n${JSON.stringify(extras.dataSample.rows.slice(0, 5), null, 2)}`
      : "",
    siblings ? `\n## Related assets in pipeline\n${siblings}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

export function buildCatalogOverviewContextBlock(summary: {
  pipelineCount: number;
  assetCount: number;
  sampleAssets: { id: string; kind: string; displayName: string; pipelineName: string }[];
}): string {
  const sample = summary.sampleAssets
    .slice(0, 25)
    .map((a) => `- [${a.kind}] ${a.displayName} (${a.pipelineName}) — ${a.id}`)
    .join("\n");
  return [
    "## Workspace catalog",
    `- Pipelines: ${summary.pipelineCount}`,
    `- Assets: ${summary.assetCount}`,
    sample ? `\n## Sample assets\n${sample}` : "",
  ].join("\n");
}
