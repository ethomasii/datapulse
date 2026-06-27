import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import {
  encryptDeploymentEnvOverrides,
  parseDeploymentEnvOverrides,
} from "@/lib/elt/deployments";
import { db } from "@/lib/db/client";
import { workspaceResourceUserId } from "@/lib/auth/workspace-access";

const patchSchema = z.object({
  label: z.string().min(1).max(64).optional(),
  envOverrides: z.record(z.string(), z.string()).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = await getWorkspacePermissions(user.id);
  if (!perms.canWrite) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id } = await ctx.params;
  const resourceUserId = workspaceResourceUserId(perms, user.id);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await db.workspaceDeployment.findFirst({
    where: { id, userId: resourceUserId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = await db.workspaceDeployment.update({
    where: { id },
    data: {
      ...(parsed.data.label !== undefined ? { label: parsed.data.label.trim() } : {}),
      ...(parsed.data.envOverrides !== undefined
        ? { envOverridesEnc: encryptDeploymentEnvOverrides(parsed.data.envOverrides) }
        : {}),
    },
  });

  return NextResponse.json({
    deployment: {
      ...row,
      envOverrideKeys: Object.keys(parseDeploymentEnvOverrides(row.envOverridesEnc)),
    },
  });
}
