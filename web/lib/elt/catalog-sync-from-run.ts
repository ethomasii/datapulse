/**
 * After a successful run, push dbt column metadata into catalog entries for transform assets.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { dbtColumnsForModel } from "@/lib/elt/dbt-artifact-manifest";
import type { DbtRunManifest } from "@/lib/elt/dbt-run-manifest";
import { parseCatalogMetadata, mergeAssetColumns } from "@/lib/elt/catalog-metadata";
import { getWorkspacePermissions, workspaceResourceUserId } from "@/lib/auth/org-permissions";

export async function syncCatalogFromDbtManifest(
  userId: string,
  pipelineId: string,
  manifest: DbtRunManifest
): Promise<number> {
  const perms = await getWorkspacePermissions(userId);
  const resourceUserId = workspaceResourceUserId(perms, userId);
  let updated = 0;

  for (const model of manifest.models) {
    if (model.status !== "success") continue;
    const assetKey = `${pipelineId}:transform:${model.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    // Asset keys use sanitizeIdPart — try matching by model name in existing entries
    const entries = await db.catalogEntry.findMany({
      where: { userId: resourceUserId, pipelineId, kind: "transform" },
    });
    const entry =
      entries.find((e) => e.assetKey.toLowerCase().endsWith(`:${model.name.toLowerCase()}`)) ??
      entries.find((e) => e.displayName?.toLowerCase() === model.name.toLowerCase());
    if (!entry) continue;

    const { columns, description } = dbtColumnsForModel(manifest, model.name);
    if (!columns.length && !description) continue;

    const existing = parseCatalogMetadata(entry.metadata);
    const merged = mergeAssetColumns(existing.columns, columns);

    await db.catalogEntry.update({
      where: { id: entry.id },
      data: {
        ...(description && !entry.description ? { description } : {}),
        metadata: {
          ...existing,
          columns: merged,
          columnSources: Array.from(new Set([...(existing.columnSources ?? []), "dbt"])),
          lastDbtSyncAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    updated += 1;
  }

  return updated;
}
