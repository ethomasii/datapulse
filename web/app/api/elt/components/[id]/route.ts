import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import { fetchComponentSchema, getComponentById } from "@/lib/elt/component-registry";
import {
  hasComponentCompiler,
  resolvePackageComponent,
} from "@/lib/elt/component-packages";
import { routeComponent } from "@/lib/elt/component-compile-router";
import {
  appendMaterializationField,
  isWarehouseMaterializationEligible,
} from "@/lib/elt/native-components/materialization-field";
import {
  dagsterAttributesToFields,
  getNativeComponent,
} from "@/lib/elt/native-components";
import { getMcpVirtualComponentDetail } from "@/lib/elt/mcp-server/virtual-components";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/elt/components/:id — component detail + optional remote schema.json
 * Query: includeSchema=1
 */
export async function GET(req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const includeSchema = url.searchParams.get("includeSchema") === "1";

  const perms = await getWorkspacePermissions(user.id);
  const mcpVirtual = await getMcpVirtualComponentDetail(id, perms.resourceOwnerIds);
  if (mcpVirtual) {
    return NextResponse.json({
      component: {
        ...mcpVirtual.component,
        isNative: true,
        isPackage: false,
        hasCompiler: true,
        packageCatalogId: null,
      },
      schema: null,
      nativeFields: mcpVirtual.formFields,
      nativeCompilerId: "mcp_tool_call",
    });
  }

  const component = getComponentById(id);
  if (!component) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let schema: unknown = null;
  if (includeSchema && component.schema_url) {
    schema = await fetchComponentSchema(component.schema_url);
  }

  const native = getNativeComponent(id);
  const pkg = await resolvePackageComponent(id);
  const hasCompiler = await hasComponentCompiler(id);
  const nativeFields = native?.fields ?? (pkg?.fields ?? null);
  let formFields = nativeFields;
  if (!formFields && schema && typeof schema === "object") {
    const attrs = (schema as Record<string, unknown>).attributes;
    if (attrs && typeof attrs === "object") {
      formFields = dagsterAttributesToFields(
        attrs as Record<string, Record<string, unknown>>,
        native?.dagsterOnlyFields ?? pkg?.dagsterOnlyFields
      );
    }
  }

  const compileTarget =
    component.compileTarget ??
    routeComponent(component.id, component.category).target;
  if (formFields && isWarehouseMaterializationEligible(compileTarget)) {
    formFields = appendMaterializationField(formFields);
  }

  return NextResponse.json({
    component: {
      ...component,
      isNative: Boolean(native),
      isPackage: Boolean(pkg),
      hasCompiler,
      packageCatalogId: pkg?.catalog.id ?? null,
    },
    schema,
    nativeFields: formFields,
    nativeCompilerId: native?.id ?? pkg?.id ?? null,
  });
}
