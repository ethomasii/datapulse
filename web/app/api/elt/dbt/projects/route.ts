import { NextResponse } from "next/server";
import { z } from "zod";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import {
  assertCanWritePipelines,
  hasCatalogReadScope,
} from "@/lib/auth/workspace-auth-helpers";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import {
  createDbtProject,
  linkDbtProjectToPipeline,
  toDbtProjectSummary,
} from "@/lib/elt/dbt-projects";

const createSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z][a-zA-Z0-9_\-]*$/, "Use letters, numbers, underscore, hyphen; start with a letter"),
  description: z.string().max(4000).nullable().optional(),
  packagePath: z.string().max(2048).optional().default(""),
  gitUrl: z.string().max(2048).nullable().optional(),
  gitBranch: z.string().max(128).nullable().optional(),
  gitSubpath: z.string().max(512).nullable().optional(),
  targetSchema: z.string().max(256).nullable().optional(),
  sourceSlug: z.string().max(128).nullable().optional(),
  hubPackageKey: z.string().max(256).nullable().optional(),
  runScope: z.enum(["all", "selection"]).optional(),
  selector: z.string().max(512).nullable().optional(),
  destinationConnectionId: z.string().nullable().optional(),
  pipelineId: z.string().nullable().optional(),
  scaffoldFromHub: z.boolean().optional(),
  linkPipelineId: z.string().nullable().optional(),
  draft: z.boolean().optional(),
  scaffoldToDefaultRepo: z.boolean().optional(),
  gitOwner: z.string().max(200).optional(),
  gitRepo: z.string().max(200).optional(),
});

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  try {
    const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);
    const rows = await db.dbtProject.findMany({
      where: { userId: { in: ownerIds } },
      orderBy: { updatedAt: "desc" },
      include: {
        pipelines: {
          select: { id: true, name: true, enabled: true, sourceType: true, destinationType: true },
        },
      },
    });
    return NextResponse.json({ projects: rows.map(toDbtProjectSummary) });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}

export async function POST(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_WRITE)) return scopeForbiddenResponse();
  const denied = await assertCanWritePipelines(auth.user.id);
  if (denied) return denied;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const body = parsed.data;
  try {
    const project = await createDbtProject(auth.user.id, {
      name: body.name,
      description: body.description,
      packagePath: body.packagePath,
      gitUrl: body.gitUrl,
      gitBranch: body.gitBranch,
      gitSubpath: body.gitSubpath,
      targetSchema: body.targetSchema,
      sourceSlug: body.sourceSlug,
      hubPackageKey: body.hubPackageKey,
      runScope: body.runScope,
      selector: body.selector,
      destinationConnectionId: body.destinationConnectionId,
      pipelineId: body.pipelineId ?? body.linkPipelineId,
      scaffoldFromHub: body.scaffoldFromHub,
      draft: body.draft,
      scaffoldToDefaultRepo: body.scaffoldToDefaultRepo,
      gitOwner: body.gitOwner,
      gitRepo: body.gitRepo,
    });

    const linkId = body.linkPipelineId ?? body.pipelineId;
    if (linkId && linkId !== body.pipelineId) {
      await linkDbtProjectToPipeline(auth.user.id, project.id, linkId);
    }

    const full = await db.dbtProject.findUnique({
      where: { id: project.id },
      include: {
        pipelines: {
          select: { id: true, name: true, enabled: true, sourceType: true, destinationType: true },
        },
      },
    });

    return NextResponse.json({ project: full ? toDbtProjectSummary(full) : project }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "A dbt project with this name already exists" }, { status: 409 });
    }
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
