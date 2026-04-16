import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { getGithubConnectionForUser } from "@/lib/db/github-connection-query";
import { ELTPULSE_REPO } from "@/lib/elt/eltpulse-repo-layout";
import { parsePipelineDeclarationYaml } from "@/lib/elt/parse-pipeline-declaration";
import { eltPipelineToDeclarationYamlString } from "@/lib/elt/pipeline-to-declaration-yaml";
import { upsertPipelineDefinition } from "@/lib/elt/persist-pipeline";
import { getGithubAccessTokenForUser } from "@/lib/integrations/github-access-token";
import {
  decodeGithubFileContent,
  githubJson,
  githubRepoContentsApiPath,
  type GithubContentDirItem,
  type GithubContentFile,
} from "@/lib/integrations/github-rest";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pull_declarations") }),
  z.object({ action: z.literal("push_pipeline"), pipelineId: z.string().min(1) }),
]);

function repoContext(
  owner: string | null | undefined,
  name: string | null | undefined,
  branch: string | null | undefined
): { ok: true; owner: string; name: string; branch: string } | { ok: false; message: string } {
  const o = owner?.trim();
  const n = name?.trim();
  if (!o || !n) {
    return {
      ok: false,
      message: "Set default owner and repository on the Repositories page (Integrations → defaults, or PATCH /api/integrations/github).",
    };
  }
  const br = (branch?.trim() || "main") || "main";
  return { ok: true, owner: o, name: n, branch: br };
}

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getGithubAccessTokenForUser(user.id);
  if (!token) {
    return NextResponse.json({ error: "GitHub is not connected." }, { status: 400 });
  }

  const { row: gh } = await getGithubConnectionForUser(user.id);
  const ctx = repoContext(gh?.defaultRepoOwner, gh?.defaultRepoName, gh?.defaultBranch);
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.message }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const basePath = ELTPULSE_REPO.pipelinesDir;

  if (parsed.data.action === "pull_declarations") {
    const listPath = githubRepoContentsApiPath(ctx.owner, ctx.name, basePath, ctx.branch);
    const { ok, status, json: dirJson } = await githubJson<GithubContentDirItem[] | { message?: string }>(
      token,
      listPath
    );
    if (status === 404) {
      return NextResponse.json(
        {
          error: `Path ${basePath} not found on ${ctx.branch}. Push a pipeline from eltPulse or add that folder in GitHub.`,
        },
        { status: 404 }
      );
    }
    if (!ok || !Array.isArray(dirJson)) {
      const msg =
        dirJson && typeof dirJson === "object" && "message" in dirJson
          ? String((dirJson as { message?: string }).message)
          : "Could not read repository path.";
      return NextResponse.json({ error: msg }, { status: status >= 400 && status < 600 ? status : 502 });
    }

    const yamls = dirJson.filter((e) => e.type === "file" && /\.ya?ml$/i.test(e.name));
    const applied: string[] = [];
    const errors: { path: string; message: string }[] = [];

    for (const f of yamls) {
      const fp = githubRepoContentsApiPath(ctx.owner, ctx.name, f.path, ctx.branch);
      const fileRes = await githubJson<GithubContentFile>(token, fp);
      if (!fileRes.ok || !fileRes.json || !("content" in fileRes.json)) {
        errors.push({ path: f.path, message: "Could not load file" });
        continue;
      }
      const file = fileRes.json;
      if (file.encoding !== "base64" || typeof file.content !== "string") {
        errors.push({ path: f.path, message: "Unexpected file encoding" });
        continue;
      }
      const yamlText = decodeGithubFileContent(file);
      let decl: ReturnType<typeof parsePipelineDeclarationYaml>;
      try {
        decl = parsePipelineDeclarationYaml(yamlText);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ path: f.path, message: msg });
        continue;
      }
      const result = await upsertPipelineDefinition(user.id, decl.body);
      if (!result.ok) {
        errors.push({ path: f.path, message: result.message });
        continue;
      }
      applied.push(decl.body.name);
    }

    return NextResponse.json({
      ok: true,
      applied,
      errors,
      branch: ctx.branch,
      path: basePath,
    });
  }

  const pipelineId = parsed.data.pipelineId;
  const row = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: user.id },
  });
  if (!row) {
    return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
  }

  const yamlText = eltPipelineToDeclarationYamlString(row);
  const relPath = `${basePath}/${row.name}.yaml`;
  const fileUrlPath = githubRepoContentsApiPath(ctx.owner, ctx.name, relPath);
  const fileUrlWithRef = `${fileUrlPath}?ref=${encodeURIComponent(ctx.branch)}`;

  const existing = await githubJson<{ sha?: string; message?: string }>(token, fileUrlWithRef);
  let sha: string | undefined;
  if (
    existing.ok &&
    existing.json &&
    typeof existing.json === "object" &&
    typeof (existing.json as { sha?: unknown }).sha === "string"
  ) {
    sha = (existing.json as { sha: string }).sha;
  }

  const putBody: Record<string, unknown> = {
    message: `[eltpulse] Sync pipeline ${row.name}`,
    content: Buffer.from(yamlText, "utf8").toString("base64"),
    branch: ctx.branch,
  };
  if (sha) putBody.sha = sha;

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

  const putJson = (await put.json()) as { message?: string; content?: { html_url?: string }; commit?: { html_url?: string } };
  if (!put.ok) {
    const msg = typeof putJson.message === "string" ? putJson.message : "GitHub rejected the commit.";
    return NextResponse.json({ error: msg }, { status: put.status >= 400 && put.status < 600 ? put.status : 502 });
  }

  return NextResponse.json({
    ok: true,
    path: relPath,
    branch: ctx.branch,
    htmlUrl: putJson.content?.html_url ?? putJson.commit?.html_url ?? null,
  });
}
