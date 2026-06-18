import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import {
  COMPONENT_MANIFEST_META,
  listComponentCategories,
  listComponents,
} from "@/lib/elt/component-registry";
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
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const { items, total } = listComponents({
    q,
    category,
    compileTarget: compileTarget ?? undefined,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return NextResponse.json({
    meta: COMPONENT_MANIFEST_META,
    categories: listComponentCategories(),
    total,
    components: items,
  });
}
