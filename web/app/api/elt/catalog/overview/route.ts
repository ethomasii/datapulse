import { NextResponse } from "next/server";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { dbtProjectsFromBundles } from "@/lib/elt/catalog-entries";
import { buildWorkspaceAssets } from "@/lib/elt/pipeline-assets";
import { ALL_CONNECTORS } from "@/lib/elt/connectors-registry";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_READ)) return scopeForbiddenResponse();

  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);
  const pipelines = await db.eltPipeline.findMany({
    where: pipelineOwnerWhere(ownerIds),
    select: {
      id: true,
      name: true,
      tool: true,
      enabled: true,
      sourceType: true,
      destinationType: true,
      sourceConfiguration: true,
      updatedAt: true,
    },
  });

  const connections = await db.connection.findMany({
    where: { userId: { in: ownerIds } },
    select: { id: true, name: true, connector: true, connectionType: true },
  });

  const catalogEntries = await db.catalogEntry.count({ where: { userId: { in: ownerIds } } });
  const registeredDbtProjects = await db.dbtProject.count({ where: { userId: { in: ownerIds } } });

  const assetsPayload = buildWorkspaceAssets(pipelines);
  const sourceUsage = new Map<string, number>();
  const destUsage = new Map<string, number>();
  for (const p of pipelines) {
    sourceUsage.set(p.sourceType, (sourceUsage.get(p.sourceType) ?? 0) + 1);
    destUsage.set(p.destinationType, (destUsage.get(p.destinationType) ?? 0) + 1);
  }

  return NextResponse.json({
    summary: {
      pipelines: pipelines.length,
      connections: connections.length,
      catalogEntries,
      dbtProjects: registeredDbtProjects,
      assets: assetsPayload.summary,
    },
    connectorUsage: {
      sources: Object.fromEntries(sourceUsage),
      destinations: Object.fromEntries(destUsage),
    },
    dbtProjects: dbtProjectsFromBundles(assetsPayload.pipelines),
    connectorsAvailable: ALL_CONNECTORS.length,
  });
}
