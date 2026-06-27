import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import {
  encryptDeploymentEnvOverrides,
  listWorkspaceDeployments,
  parseDeploymentEnvOverrides,
} from "@/lib/elt/deployments";
import { db } from "@/lib/db/client";
import { workspaceResourceUserId } from "@/lib/auth/workspace-access";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const deployments = await listWorkspaceDeployments(user.id);
    return NextResponse.json({ deployments });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("WorkspaceDeployment") || msg.includes("does not exist")) {
      return NextResponse.json(
        { error: "Deployments table missing — run prisma db push from web/", deployments: [] },
        { status: 503 }
      );
    }
    throw e;
  }
}

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = await getWorkspacePermissions(user.id);
  if (!perms.canWrite) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = z
    .object({
      slug: z.string().min(1).max(48),
      label: z.string().min(1).max(64),
      isDefault: z.boolean().optional(),
    })
    .safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const resourceUserId = workspaceResourceUserId(perms, user.id);
  const slug = parsed.data.slug.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");

  if (parsed.data.isDefault) {
    await db.workspaceDeployment.updateMany({
      where: { userId: resourceUserId },
      data: { isDefault: false },
    });
  }

  const row = await db.workspaceDeployment.create({
    data: {
      userId: resourceUserId,
      slug,
      label: parsed.data.label.trim(),
      isDefault: parsed.data.isDefault ?? false,
    },
  });

  return NextResponse.json({ deployment: row }, { status: 201 });
}
