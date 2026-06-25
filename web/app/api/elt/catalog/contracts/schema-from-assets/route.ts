import { NextResponse } from "next/server";
import {
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { hasCatalogReadScope } from "@/lib/auth/workspace-auth-helpers";
import { loadContractSchemaFromAssetKeys } from "@/lib/elt/load-contract-schema-from-assets";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const url = new URL(req.url);
  const rawKeys = url.searchParams.get("assetKeys")?.trim();
  if (!rawKeys) {
    return NextResponse.json({ error: "assetKeys required" }, { status: 400 });
  }

  const assetKeys = rawKeys.split(",").map((k) => k.trim()).filter(Boolean);
  const fetchWarehouseColumns = url.searchParams.get("columns") === "1";

  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);
  const result = await loadContractSchemaFromAssetKeys(ownerIds, assetKeys, {
    fetchWarehouseColumns,
    requiredByDefault: true,
  });

  return NextResponse.json(result);
}
