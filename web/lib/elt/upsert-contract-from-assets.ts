import { db } from "@/lib/db/client";
import { slugifyContract, suggestContractIdentity } from "@/lib/elt/contract-from-asset";
import { loadContractSchemaFromAssetKeys } from "@/lib/elt/load-contract-schema-from-assets";

export async function upsertContractFromAssets(
  resourceUserId: string,
  ownerIds: string[],
  assetKeys: string[],
  options?: {
    name?: string;
    slug?: string;
    description?: string | null;
    status?: "draft" | "active" | "deprecated";
    freshnessSlaHours?: number | null;
    fetchWarehouseColumns?: boolean;
  }
): Promise<{ contract: Awaited<ReturnType<typeof loadFullContract>>; created: boolean } | null> {
  const uniqueKeys = [...new Set(assetKeys.map((k) => k.trim()).filter(Boolean))];
  if (!uniqueKeys.length) return null;

  const loaded = await loadContractSchemaFromAssetKeys(ownerIds, uniqueKeys, {
    fetchWarehouseColumns: options?.fetchWarehouseColumns ?? true,
    requiredByDefault: true,
  });
  if (!loaded.assets.length) return null;

  const primary = loaded.assets[0]!;
  const identity = suggestContractIdentity({
    displayName: primary.displayName,
    assetKey: primary.assetKey,
    pipelineName: primary.pipelineName,
  });
  const slug = options?.slug?.trim() || identity.slug;
  const name = options?.name?.trim() || identity.name;

  const existingBySlug = await db.dataContract.findUnique({
    where: { userId_slug: { userId: resourceUserId, slug } },
    select: { id: true },
  });
  const existingByAsset =
    uniqueKeys.length === 1
      ? await db.dataContractAsset.findFirst({
          where: {
            assetKey: uniqueKeys[0],
            contract: { userId: resourceUserId },
          },
          select: { contractId: true },
        })
      : null;

  const existingId = existingBySlug?.id ?? existingByAsset?.contractId;
  const created = !existingId;

  const row = existingId
    ? await db.dataContract.update({
        where: { id: existingId },
        data: {
          name,
          schemaSpec: loaded.schemaSpec,
          status: options?.status ?? "active",
          ...(options?.description !== undefined ? { description: options.description } : {}),
          ...(options?.freshnessSlaHours !== undefined
            ? { freshnessSlaHours: options.freshnessSlaHours }
            : {}),
        },
      })
    : await db.dataContract.create({
        data: {
          userId: resourceUserId,
          slug,
          name,
          description: options?.description ?? null,
          status: options?.status ?? "active",
          freshnessSlaHours: options?.freshnessSlaHours ?? null,
          schemaSpec: loaded.schemaSpec,
        },
      });

  await db.dataContractAsset.deleteMany({ where: { contractId: row.id } });
  await db.dataContractAsset.createMany({
    data: uniqueKeys.map((assetKey) => ({ contractId: row.id, assetKey })),
  });

  const contract = await loadFullContract(row.id);
  return contract ? { contract, created } : null;
}

async function loadFullContract(id: string) {
  return db.dataContract.findUnique({
    where: { id },
    include: { assets: true },
  });
}

/** Default contract slug for a single certified asset. */
export function certifiedAssetContractSlug(assetKey: string, displayName: string): string {
  const base = displayName.trim() || assetKey.split(":").pop() || "asset";
  return slugifyContract(`${base}-certified`);
}
