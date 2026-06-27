import { decryptSecret, encryptSecret } from "@/lib/crypto/token-encryption";
import { db } from "@/lib/db/client";
import { getAccessibleResourceOwnerIds, workspaceResourceUserId } from "@/lib/auth/workspace-access";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import { loadWorkspaceConnectionById } from "@/lib/elt/workspace-connection-load";

export type DeploymentSummary = {
  id: string;
  slug: string;
  label: string;
  isDefault: boolean;
  envOverrideKeys: string[];
};

export type PipelineDeploymentBindingInput = {
  deploymentId: string;
  sourceConnectionId?: string | null;
  destinationConnectionId?: string | null;
};

const DEFAULT_DEPLOYMENTS = [
  { slug: "development", label: "Development", isDefault: true },
  { slug: "production", label: "Production", isDefault: false },
] as const;

export function normalizeDeploymentSlug(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "default";
}

export function parseDeploymentEnvOverrides(enc: string | null | undefined): Record<string, string> {
  if (!enc?.trim()) return {};
  try {
    const raw = decryptSecret(enc);
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof k === "string" && typeof v === "string" && k.trim()) out[k.trim()] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function encryptDeploymentEnvOverrides(values: Record<string, string>): string | null {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string" && v.length) cleaned[k.trim()] = v;
  }
  if (!Object.keys(cleaned).length) return null;
  return encryptSecret(JSON.stringify(cleaned));
}

/** Ensure development + production rows exist for a workspace owner. */
export async function ensureDefaultDeployments(userId: string): Promise<void> {
  const resourceUserId = workspaceResourceUserId(await getWorkspacePermissions(userId), userId);
  const existing = await db.workspaceDeployment.count({ where: { userId: resourceUserId } });
  if (existing > 0) return;
  for (const d of DEFAULT_DEPLOYMENTS) {
    await db.workspaceDeployment.create({
      data: {
        userId: resourceUserId,
        slug: d.slug,
        label: d.label,
        isDefault: d.isDefault,
      },
    });
  }
}

export async function listWorkspaceDeployments(userId: string): Promise<DeploymentSummary[]> {
  await ensureDefaultDeployments(userId);
  const resourceUserId = workspaceResourceUserId(await getWorkspacePermissions(userId), userId);
  const rows = await db.workspaceDeployment.findMany({
    where: { userId: resourceUserId },
    orderBy: [{ isDefault: "desc" }, { slug: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    label: r.label,
    isDefault: r.isDefault,
    envOverrideKeys: Object.keys(parseDeploymentEnvOverrides(r.envOverridesEnc)),
  }));
}

export async function resolveDeploymentForEnvironment(
  userId: string,
  environment: string
): Promise<{ id: string; slug: string; label: string; envOverrides: Record<string, string> } | null> {
  await ensureDefaultDeployments(userId);
  const resourceUserId = workspaceResourceUserId(await getWorkspacePermissions(userId), userId);
  const slug = normalizeDeploymentSlug(environment);
  const rows = await db.workspaceDeployment.findMany({ where: { userId: resourceUserId } });
  if (!rows.length) return null;

  let match =
    rows.find((r) => r.slug === slug) ??
    (slug === "default" ? rows.find((r) => r.isDefault) : undefined) ??
    rows.find((r) => r.isDefault) ??
    rows[0]!;

  return {
    id: match.id,
    slug: match.slug,
    label: match.label,
    envOverrides: parseDeploymentEnvOverrides(match.envOverridesEnc),
  };
}

export async function resolvePipelineConnectionsForEnvironment(
  userId: string,
  pipeline: {
    id: string;
    sourceConnectionId: string | null;
    destinationConnectionId: string | null;
  },
  environment: string
): Promise<{
  deploymentSlug: string;
  sourceConnectionId: string | null;
  destinationConnectionId: string | null;
  envOverrides: Record<string, string>;
}> {
  const deployment = await resolveDeploymentForEnvironment(userId, environment);
  if (!deployment) {
    return {
      deploymentSlug: normalizeDeploymentSlug(environment),
      sourceConnectionId: pipeline.sourceConnectionId,
      destinationConnectionId: pipeline.destinationConnectionId,
      envOverrides: {},
    };
  }

  const binding = await db.pipelineDeploymentBinding.findUnique({
    where: {
      pipelineId_deploymentId: {
        pipelineId: pipeline.id,
        deploymentId: deployment.id,
      },
    },
  });

  return {
    deploymentSlug: deployment.slug,
    sourceConnectionId: binding?.sourceConnectionId ?? pipeline.sourceConnectionId,
    destinationConnectionId: binding?.destinationConnectionId ?? pipeline.destinationConnectionId,
    envOverrides: deployment.envOverrides,
  };
}

/** Flat env map for gateway workers: source + destination secrets + deployment overrides. */
export async function resolveRunConnectionEnv(
  userId: string,
  pipeline: {
    id: string;
    sourceConnectionId: string | null;
    destinationConnectionId: string | null;
  },
  environment: string
): Promise<Record<string, string>> {
  const resolved = await resolvePipelineConnectionsForEnvironment(userId, pipeline, environment);
  const env: Record<string, string> = { ...resolved.envOverrides };

  const [source, destination] = await Promise.all([
    loadWorkspaceConnectionById(userId, resolved.sourceConnectionId),
    loadWorkspaceConnectionById(userId, resolved.destinationConnectionId),
  ]);

  if (source?.secrets) Object.assign(env, source.secrets);
  if (destination?.secrets) Object.assign(env, destination.secrets);

  return env;
}

export async function upsertPipelineDeploymentBindings(
  userId: string,
  pipelineId: string,
  bindings: PipelineDeploymentBindingInput[]
): Promise<void> {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
    select: { id: true },
  });
  if (!pipeline) throw new Error("Pipeline not found");

  const resourceUserId = workspaceResourceUserId(await getWorkspacePermissions(userId), userId);
  const deployments = await db.workspaceDeployment.findMany({
    where: { userId: resourceUserId },
    select: { id: true },
  });
  const allowed = new Set(deployments.map((d) => d.id));

  for (const b of bindings) {
    if (!allowed.has(b.deploymentId)) continue;
    await db.pipelineDeploymentBinding.upsert({
      where: {
        pipelineId_deploymentId: { pipelineId, deploymentId: b.deploymentId },
      },
      create: {
        pipelineId,
        deploymentId: b.deploymentId,
        sourceConnectionId: b.sourceConnectionId ?? null,
        destinationConnectionId: b.destinationConnectionId ?? null,
      },
      update: {
        sourceConnectionId: b.sourceConnectionId ?? null,
        destinationConnectionId: b.destinationConnectionId ?? null,
      },
    });
  }
}

export async function listPipelineDeploymentBindings(userId: string, pipelineId: string) {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
    select: { id: true },
  });
  if (!pipeline) return [];

  return db.pipelineDeploymentBinding.findMany({
    where: { pipelineId },
    include: {
      deployment: { select: { id: true, slug: true, label: true, isDefault: true } },
    },
  });
}

/** Resolve destination connection row for warehouse preview with deployment overrides. */
export async function loadDestinationForPipelineEnvironment(
  userId: string,
  pipeline: {
    id: string;
    destinationConnectionId: string | null;
  },
  environment: string
) {
  const resolved = await resolvePipelineConnectionsForEnvironment(userId, pipeline, environment);
  return loadWorkspaceConnectionById(userId, resolved.destinationConnectionId);
}
