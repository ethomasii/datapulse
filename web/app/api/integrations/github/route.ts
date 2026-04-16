import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";

const patchBodySchema = z.object({
  defaultRepoOwner: z.union([z.string().min(1).max(200), z.null()]).optional(),
  defaultRepoName: z.union([z.string().min(1).max(200), z.null()]).optional(),
  defaultBranch: z.union([z.string().min(1).max(255), z.null()]).optional(),
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

  const existing = await db.githubConnection.findUnique({ where: { userId: user.id } });
  if (!existing) {
    return NextResponse.json({ error: "Connect GitHub first (Integrations)." }, { status: 400 });
  }

  const data: {
    defaultRepoOwner?: string | null;
    defaultRepoName?: string | null;
    defaultBranch?: string | null;
  } = {};
  if (parsed.data.defaultRepoOwner !== undefined) data.defaultRepoOwner = parsed.data.defaultRepoOwner;
  if (parsed.data.defaultRepoName !== undefined) data.defaultRepoName = parsed.data.defaultRepoName;
  if (parsed.data.defaultBranch !== undefined) data.defaultBranch = parsed.data.defaultBranch;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const row = await db.githubConnection.update({
      where: { userId: user.id },
      data,
      select: {
        githubLogin: true,
        defaultRepoOwner: true,
        defaultRepoName: true,
        defaultBranch: true,
      },
    });
    return NextResponse.json({ connection: row });
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
