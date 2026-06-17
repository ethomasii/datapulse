import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { generateDbtScaffoldFiles, scaffoldPackagePathForPipeline } from "@/lib/elt/dbt-scaffold";
import { resolveDbtHubPackage } from "@/lib/elt/dbt-hub-packages";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { setDbtTransformConfig } from "@/lib/elt/dbt-run-phases";
import { getGithubConnectionForUser } from "@/lib/db/github-connection-query";
import { getGithubAccessTokenForUser } from "@/lib/integrations/github-access-token";
import { githubJson, githubRepoContentsApiPath } from "@/lib/integrations/github-rest";

const bodySchema = z.object({
  pipelineId: z.string().min(1),
  sourceSlug: z.string().optional(),
  pushToGit: z.boolean().optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ownerIds = await getAccessibleResourceOwnerIds(user.id);
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: parsed.data.pipelineId, userId: { in: ownerIds } },
  });
  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

  const sourceSlug = parsed.data.sourceSlug ?? pipeline.sourceType;
  const hub = resolveDbtHubPackage(sourceSlug);
  if (!hub) {
    return NextResponse.json(
      { error: `No staging dbt package for connector "${sourceSlug}"` },
      { status: 400 }
    );
  }

  const files = generateDbtScaffoldFiles(pipeline.name, hub);
  const packagePath = scaffoldPackagePathForPipeline(pipeline.name);

  const pushed: string[] = [];
  const pushErrors: string[] = [];

  if (parsed.data.pushToGit) {
    const token = await getGithubAccessTokenForUser(user.id);
    const { row: gh } = await getGithubConnectionForUser(user.id);
    const owner = gh?.defaultRepoOwner?.trim();
    const name = gh?.defaultRepoName?.trim();
    const branch = (gh?.defaultBranch?.trim() || "main") || "main";

    if (!token || !owner || !name) {
      return NextResponse.json(
        { error: "Connect GitHub and set a default repository to push scaffold files." },
        { status: 400 }
      );
    }

    for (const file of files) {
      const fileUrlPath = githubRepoContentsApiPath(owner, name, file.path);
      const fileUrlWithRef = `${fileUrlPath}?ref=${encodeURIComponent(branch)}`;
      const existing = await githubJson<{ sha?: string }>(token, fileUrlWithRef);
      const putBody: Record<string, unknown> = {
        message: `[eltpulse] Scaffold dbt for ${pipeline.name}`,
        content: Buffer.from(file.content, "utf8").toString("base64"),
        branch,
      };
      if (existing.ok && existing.json?.sha) putBody.sha = existing.json.sha;

      const put = await fetch(`https://api.github.com${fileUrlPath}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(putBody),
      });
      if (put.ok) pushed.push(file.path);
      else {
        const t = await put.text();
        pushErrors.push(`${file.path}: ${t.slice(0, 200)}`);
      }
    }
  }

  const src = { ...(pipeline.sourceConfiguration as Record<string, unknown>) };
  setDbtTransformConfig(src, {
    enabled: true,
    package_path: packagePath,
    dataset_name: `${pipeline.name.replace(/[^a-zA-Z0-9_]/g, "_")}_dbt`,
    run_scope: "all",
    hub_package: hub.package,
  });
  await db.eltPipeline.update({
    where: { id: pipeline.id },
    data: { sourceConfiguration: src as object },
  });

  return NextResponse.json({
    ok: true,
    packagePath,
    hubPackage: hub.package,
    files: files.map((f) => ({ path: f.path, bytes: f.content.length })),
    pushed,
    pushErrors,
    pipelineId: pipeline.id,
  });
}
