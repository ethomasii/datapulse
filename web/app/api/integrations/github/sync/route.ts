import { NextResponse } from "next/server";
import { z } from "zod";
import YAML from "yaml";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { db } from "@/lib/db/client";
import { getGithubConnectionForUser } from "@/lib/db/github-connection-query";
import { ELTPULSE_REPO } from "@/lib/elt/eltpulse-repo-layout";
import { resolveWorkspaceGithubOwnerId } from "@/lib/elt/workspace-github";
import { parsePipelineDeclarationYaml, parseAndCompileDeclarativeYaml } from "@/lib/elt/parse-pipeline-declaration";
import { upsertPipelineDefinition } from "@/lib/elt/persist-pipeline";
import { getGithubAccessTokenForUser } from "@/lib/integrations/github-access-token";
import { pushPipelineToGithub } from "@/lib/integrations/github-push-pipeline";
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
  z.object({ action: z.literal("push_monitors") }),
  z.object({ action: z.literal("pull_monitors") }),
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
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();

  const user = auth.user;
  const connectionUserId = await resolveWorkspaceGithubOwnerId(user.id);

  const token = await getGithubAccessTokenForUser(connectionUserId);
  if (!token) {
    return NextResponse.json({ error: "GitHub is not connected." }, { status: 400 });
  }

  const { row: gh } = await getGithubConnectionForUser(connectionUserId);
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
    if (auth.via === "api_key" && !hasScope(auth, API_SCOPES.PIPELINES_WRITE)) {
      return scopeForbiddenResponse();
    }
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
      try {
        let body;
        let deploymentBindings;
        let declarativeSpecYaml;
        try {
          const compiled = await parseAndCompileDeclarativeYaml(user.id, yamlText);
          body = compiled.body;
          deploymentBindings = compiled.deploymentBindings;
          declarativeSpecYaml = compiled.declarativeSpecYaml;
        } catch {
          const decl = parsePipelineDeclarationYaml(yamlText);
          body = decl.body;
        }
        const result = await upsertPipelineDefinition(user.id, body, {
          ...(declarativeSpecYaml ? { declarativeSpecYaml } : {}),
          ...(deploymentBindings ? { deploymentBindings } : {}),
        });
        if (!result.ok) {
          errors.push({ path: f.path, message: result.message });
          continue;
        }
        applied.push(body.name);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ path: f.path, message: msg });
        continue;
      }
    }

    return NextResponse.json({
      ok: true,
      applied,
      errors,
      branch: ctx.branch,
      path: basePath,
    });
  }

  if (parsed.data.action === "push_monitors") {
    const monitors = await db.eltMonitor.findMany({
      where: { userId: user.id },
      include: { pipeline: { select: { name: true } } },
      orderBy: { name: "asc" },
    });

    if (monitors.length === 0) {
      return NextResponse.json({ ok: true, pushed: [], message: "No monitors to push." });
    }

    const pushed: string[] = [];
    const errors: { name: string; message: string }[] = [];
    const monitorsPath = ELTPULSE_REPO.monitorsDir;

    for (const m of monitors) {
      const doc: Record<string, unknown> = {
        eltpulse_monitor_declaration: 1,
        upsert: true,
        name: m.name,
        pipeline_name: m.pipeline.name,
        type: m.type,
        execution_host: m.executionHost,
        config: m.config as Record<string, unknown>,
      };
      const yamlText = YAML.stringify(doc, { lineWidth: 0 }).trimEnd() + "\n";
      const relPath = `${monitorsPath}/${m.name}.yaml`;
      const fileUrlPath = githubRepoContentsApiPath(ctx.owner, ctx.name, relPath);
      const existing = await githubJson<{ sha?: string }>(token, `${fileUrlPath}?ref=${encodeURIComponent(ctx.branch)}`);
      const sha = existing.ok && existing.json && typeof (existing.json as { sha?: unknown }).sha === "string"
        ? (existing.json as { sha: string }).sha
        : undefined;

      const putBody: Record<string, unknown> = {
        message: `[eltpulse] Sync monitor ${m.name}`,
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

      if (put.ok) {
        pushed.push(m.name);
      } else {
        const j = (await put.json()) as { message?: string };
        errors.push({ name: m.name, message: typeof j.message === "string" ? j.message : "GitHub rejected the commit" });
      }
    }

    return NextResponse.json({ ok: errors.length === 0, pushed, errors, branch: ctx.branch, path: monitorsPath });
  }

  if (parsed.data.action === "pull_monitors") {
    const monitorsPath = ELTPULSE_REPO.monitorsDir;
    const listPath = githubRepoContentsApiPath(ctx.owner, ctx.name, monitorsPath, ctx.branch);
    const { ok, status, json: dirJson } = await githubJson<GithubContentDirItem[] | { message?: string }>(token, listPath);

    if (status === 404) {
      return NextResponse.json(
        { error: `Path ${monitorsPath} not found on ${ctx.branch}. Push monitors from eltPulse first.` },
        { status: 404 }
      );
    }
    if (!ok || !Array.isArray(dirJson)) {
      const msg = dirJson && typeof dirJson === "object" && "message" in dirJson
        ? String((dirJson as { message?: string }).message)
        : "Could not read monitors path.";
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

      let doc: Record<string, unknown>;
      try {
        const text = decodeGithubFileContent(file);
        doc = (YAML.parse(text) as Record<string, unknown>) ?? {};
      } catch (e) {
        errors.push({ path: f.path, message: `Invalid YAML: ${e instanceof Error ? e.message : String(e)}` });
        continue;
      }

      const monitorName = typeof doc.name === "string" ? doc.name.trim() : "";
      const pipelineName = typeof doc.pipeline_name === "string" ? doc.pipeline_name.trim() : "";
      const type = typeof doc.type === "string" ? doc.type.trim() : "";

      if (!monitorName || !pipelineName || !type) {
        errors.push({ path: f.path, message: "Missing required fields: name, pipeline_name, type" });
        continue;
      }

      const pipeline = await db.eltPipeline.findFirst({ where: { name: pipelineName, userId: user.id }, select: { id: true } });
      if (!pipeline) {
        errors.push({ path: f.path, message: `Pipeline "${pipelineName}" not found — import pipelines first` });
        continue;
      }

      const config = doc.config && typeof doc.config === "object" && !Array.isArray(doc.config)
        ? (doc.config as Record<string, unknown>)
        : {};

      type MonitorData = Parameters<typeof db.eltMonitor.upsert>[0]["create"];
      const monitorConfig = config as MonitorData["config"];
      await db.eltMonitor.upsert({
        where: { userId_name: { userId: user.id, name: monitorName } },
        create: { userId: user.id, name: monitorName, pipelineId: pipeline.id, type, config: monitorConfig, executionHost: "inherit" },
        update: { type, config: monitorConfig, pipelineId: pipeline.id },
      });
      applied.push(monitorName);
    }

    return NextResponse.json({ ok: true, applied, errors, branch: ctx.branch, path: monitorsPath });
  }

  const pipelineId = parsed.data.pipelineId;
  const result = await pushPipelineToGithub(user.id, pipelineId, {
    branch: gh?.developmentBranch?.trim() || "develop",
  });
  if (!result.ok) {
    const status = result.skipped ? 400 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({
    ok: true,
    path: result.path,
    branch: result.branch,
    htmlUrl: result.htmlUrl,
  });
}
