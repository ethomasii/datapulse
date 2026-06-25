/** Build data contract schema specs from catalog asset column profiles. */

import type { AssetColumnDef } from "@/lib/elt/catalog-metadata";
import type { ContractColumnSpec } from "@/lib/elt/data-contract";

export function assetColumnsToContractSchema(
  columns: AssetColumnDef[],
  options?: { requiredByDefault?: boolean }
): ContractColumnSpec[] {
  const requiredByDefault = options?.requiredByDefault ?? true;
  const seen = new Set<string>();
  const out: ContractColumnSpec[] = [];
  for (const col of columns) {
    const name = col.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      ...(col.type ? { type: col.type } : {}),
      ...(col.description ? { description: col.description } : {}),
      ...(requiredByDefault ? { required: true } : {}),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Union column specs from multiple assets — first wins for type/description. */
export function mergeContractSchemaSpecs(...groups: ContractColumnSpec[][]): ContractColumnSpec[] {
  const byName = new Map<string, ContractColumnSpec>();
  for (const group of groups) {
    for (const col of group) {
      const key = col.name.toLowerCase();
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, { ...col });
        continue;
      }
      byName.set(key, {
        name: existing.name,
        type: existing.type ?? col.type,
        description: existing.description ?? col.description,
        required: existing.required || col.required,
      });
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function suggestContractIdentity(input: {
  displayName: string;
  assetKey: string;
  pipelineName?: string;
}): { name: string; slug: string } {
  const base = input.displayName.trim() || input.assetKey.split(":").pop() || "asset";
  return {
    name: `${base} contract`,
    slug: slugifyContract(`${base}-${input.pipelineName ?? "asset"}`),
  };
}

export function slugifyContract(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}
