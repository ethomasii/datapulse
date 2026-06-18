import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import {
  COMPONENT_MANIFEST_META,
  listComponentCategories,
  listComponents,
} from "@/lib/elt/component-registry";
import { listPackageCatalogComponents } from "@/lib/elt/component-packages";
import { defaultCatalogSources } from "@/lib/elt/component-packages/catalog-sources";
import { loadWorkspaceCatalogUrls } from "@/lib/elt/workspace-catalog-sources";
import type { ComponentCompileTarget } from "@/lib/elt/component-compile-router";

/**
 * GET /api/elt/components?q=&category=&compileTarget=&limit=&offset=
 * Read-only catalog of dagster-component-templates (manifest index).
 */
export async function GET(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const compileTarget = url.searchParams.get("compileTarget") as ComponentCompileTarget | null;
  const includePackages = url.searchParams.get("includePackages") === "1";
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const { items, total } = listComponents({
    q,
    category,
    compileTarget: compileTarget ?? undefined,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  let packageItems: Awaited<ReturnType<typeof listPackageCatalogComponents>> = [];
  if (includePackages) {
    const workspaceCatalogUrls = await loadWorkspaceCatalogUrls(user.id);
    packageItems = await listPackageCatalogComponents(undefined, workspaceCatalogUrls);
    if (q?.trim()) {
      const ql = q.trim().toLowerCase();
      packageItems = packageItems.filter(
        (p) =>
          p.id.toLowerCase().includes(ql) ||
          p.name.toLowerCase().includes(ql) ||
          p.description.toLowerCase().includes(ql)
      );
    }
    if (category) {
      packageItems = packageItems.filter((p) => p.category === category);
    }
  }

  const packageAsList = packageItems.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    compileTarget: p.compileTarget,
    compileBadge: "package" as const,
    compileHint: `Package compiler (${p.catalogId})`,
    canvasPorts: { left: true, right: true },
    isNative: false,
    isPackage: true,
    hasCompiler: true,
  }));

  const merged = [...packageAsList, ...items.filter((i) => !packageAsList.some((p) => p.id === i.id))];

  return NextResponse.json({
    meta: COMPONENT_MANIFEST_META,
    catalogs: [
      ...defaultCatalogSources().map((c) => c.id),
      ...(await loadWorkspaceCatalogUrls(user.id)),
    ],
    categories: listComponentCategories(),
    total: total + packageAsList.length,
    components: merged.slice(0, Number.isFinite(limit) ? limit : 50),
  });
}
