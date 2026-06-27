import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getWorkspacePermissions, workspaceResourceUserId } from "@/lib/auth/org-permissions";
import { db } from "@/lib/db/client";

const definitionSourceSchema = z.enum(["neon", "git"]);

const patchBodySchema = z.object({
  defaultRepoOwner: z.union([z.string().min(1).max(200), z.null()]).optional(),
  defaultRepoName: z.union([z.string().min(1).max(200), z.null()]).optional(),
  defaultBranch: z.union([z.string().min(1).max(255), z.null()]).optional(),
  developmentBranch: z.union([z.string().min(1).max(255), z.null()]).optional(),
  productionDefinitionSource: definitionSourceSchema.optional(),
  developmentDefinitionSource: definitionSourceSchema.optional(),
  /** Personal feature branch for canvas saves (any workspace member). */
  personalDevBranch: z.union([z.string().min(1).max(255), z.null()]).optional(),
});

/** Update default repository / branch for BYO GitHub (requires an existing connection row). */
export async function PATCH(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const perms = await getWorkspacePermissions(user.id);
  const connectionUserId = workspaceResourceUserId(perms, user.id);
  const isWorkspaceOwner = connectionUserId === user.id;

  const personalOnly =
    parsed.data.personalDevBranch !== undefined &&
    Object.keys(parsed.data).filter((k) => k !== "personalDevBranch").length === 0;

  if (personalOnly) {
    await db.user.update({
      where: { id: user.id },
      data: { personalDevBranch: parsed.data.personalDevBranch ?? null },
    });
    return NextResponse.json({ ok: true, personalDevBranch: parsed.data.personalDevBranch ?? null });
  }

  const existing = await db.githubConnection.findUnique({ where: { userId: connectionUserId } });
  if (!existing) {
    return NextResponse.json({ error: "Connect GitHub first (Integrations)." }, { status: 400 });
  }

  if (!isWorkspaceOwner) {
    return NextResponse.json(
      { error: "Only the workspace owner can change repository and definition source settings." },
      { status: 403 }
    );
  }

  const data: Prisma.GithubConnectionUpdateInput = {};
  if (parsed.data.defaultRepoOwner !== undefined) data.defaultRepoOwner = parsed.data.defaultRepoOwner;
  if (parsed.data.defaultRepoName !== undefined) data.defaultRepoName = parsed.data.defaultRepoName;
  if (parsed.data.defaultBranch !== undefined) data.defaultBranch = parsed.data.defaultBranch;
  if (parsed.data.developmentBranch !== undefined) data.developmentBranch = parsed.data.developmentBranch;
  if (parsed.data.productionDefinitionSource !== undefined) {
    data.productionDefinitionSource = parsed.data.productionDefinitionSource;
  }
  if (parsed.data.developmentDefinitionSource !== undefined) {
    data.developmentDefinitionSource = parsed.data.developmentDefinitionSource;
  }

  if (parsed.data.personalDevBranch !== undefined) {
    await db.user.update({
      where: { id: user.id },
      data: { personalDevBranch: parsed.data.personalDevBranch ?? null },
    });
  }

  if (Object.keys(data).length === 0 && parsed.data.personalDevBranch === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const row =
      Object.keys(data).length > 0
        ? await db.githubConnection.update({
            where: { userId: connectionUserId },
            data,
            select: {
              githubLogin: true,
              defaultRepoOwner: true,
              defaultRepoName: true,
              defaultBranch: true,
              developmentBranch: true,
              productionDefinitionSource: true,
              developmentDefinitionSource: true,
            },
          })
        : null;

    const personal = await db.user.findUnique({
      where: { id: user.id },
      select: { personalDevBranch: true },
    });

    return NextResponse.json({
      connection: row,
      personalDevBranch: personal?.personalDevBranch ?? null,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      return NextResponse.json(
        { error: "Database schema is missing the GithubConnection table. Run npm run db:push from web/." },
        { status: 503 }
      );
    }
    throw e;
  }
}

/** Disconnect GitHub (revoke is manual on GitHub; we delete our copy of the token). */
export async function DELETE() {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.githubConnection.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      return NextResponse.json(
        { error: "Database schema is missing the GithubConnection table. Run npm run db:push from web/." },
        { status: 503 }
      );
    }
    throw e;
  }
}
