import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { fetchComponentSchema, getComponentById } from "@/lib/elt/component-registry";
import {
  dagsterAttributesToFields,
  getNativeComponent,
  isNativeComponent,
} from "@/lib/elt/native-components";

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

  const native = getNativeComponent(id);
  const nativeFields = native?.fields ?? null;
  let formFields = nativeFields;
  if (!formFields && schema && typeof schema === "object") {
    const attrs = (schema as Record<string, unknown>).attributes;
    if (attrs && typeof attrs === "object") {
      formFields = dagsterAttributesToFields(
        attrs as Record<string, Record<string, unknown>>,
        native?.dagsterOnlyFields
      );
    }
  }

  return NextResponse.json({
    component: { ...component, isNative: isNativeComponent(id) },
    schema,
    nativeFields: formFields,
    nativeCompilerId: native?.id ?? null,
  });
}
