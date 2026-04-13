import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";

/**
 * Pending runs visible to `GET /api/agent/runs` for this Bearer identity.
 * Named connector: sees untargeted runs + runs targeted to this token.
 * Account-wide `User.agentToken` or org token (no `AgentToken` row): only untargeted runs (named gateways own targeted work).
 */
export function agentPollRunsWhere(
  userId: string,
  namedAgentTokenId: string | null
): Prisma.EltPipelineRunWhereInput {
  if (namedAgentTokenId) {
    return {
      userId,
      OR: [{ targetAgentTokenId: null }, { targetAgentTokenId: namedAgentTokenId }],
    };
  }
  return { userId, targetAgentTokenId: null };
}

export function agentCanMutateRun(namedAgentTokenId: string | null, runTargetId: string | null): boolean {
  if (!runTargetId) return true;
  return namedAgentTokenId !== null && runTargetId === namedAgentTokenId;
}

export async function assertUserOwnsGatewayToken(userId: string, tokenId: string): Promise<void> {
  const row = await db.agentToken.findFirst({
    where: { id: tokenId, userId, revokedAt: null },
    select: { id: true },
  });
  if (!row) {
    throw new Error("Gateway not found or revoked");
  }
}

/** When the account has exactly one active named gateway, return its id; otherwise null. */
export async function singleNamedGatewayTokenIdForUser(userId: string): Promise<string | null> {
  const tokens = await db.agentToken.findMany({
    where: { userId, revokedAt: null },
    select: { id: true },
    take: 2,
  });
  if (tokens.length === 1) return tokens[0].id;
  return null;
}

/**
 * Resolves which named gateway should execute the run.
 * - Explicit `null`: any gateway (account-wide poller or competing named gateways).
 * - Explicit string: that gateway (must be owned and active).
 * - `undefined`: pipeline default if valid; else if exactly one named gateway exists, pin to it; else null.
 */
export async function resolveRunTargetAgentTokenId(params: {
  userId: string;
  bodyOverride: string | null | undefined;
  pipelineDefaultId: string | null;
}): Promise<string | null> {
  const { userId, bodyOverride, pipelineDefaultId } = params;
  if (bodyOverride !== undefined) {
    if (bodyOverride === null) return null;
    await assertUserOwnsGatewayToken(userId, bodyOverride);
    return bodyOverride;
  }
  if (pipelineDefaultId) {
    try {
      await assertUserOwnsGatewayToken(userId, pipelineDefaultId);
      return pipelineDefaultId;
    } catch {
      // Stored default points at a revoked or missing token.
    }
  }
  return (await singleNamedGatewayTokenIdForUser(userId)) ?? null;
}
