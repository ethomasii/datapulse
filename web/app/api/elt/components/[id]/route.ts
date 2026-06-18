import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { fetchComponentSchema, getComponentById } from "@/lib/elt/component-registry";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/elt/components/:id — component detail + optional remote schema.json
 * Query: includeSchema=1
 */
export async function GET(req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const component = getComponentById(id);
  if (!component) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const includeSchema = url.searchParams.get("includeSchema") === "1";

  let schema: unknown = null;
  if (includeSchema && component.schema_url) {
    schema = await fetchComponentSchema(component.schema_url);
  }

  return NextResponse.json({ component, schema });
}
