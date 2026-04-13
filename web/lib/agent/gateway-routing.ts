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

/**
 * User may use a personal token (`userId` match, no org) or any org token for an org they own or belong to.
 */
export async function assertActorOwnsGatewayToken(actorUserId: string, tokenId: string): Promise<void> {
  const row = await db.agentToken.findFirst({
    where: {
      id: tokenId,
      revokedAt: null,
      OR: [
        { userId: actorUserId, organizationId: null },
        {
          organizationId: { not: null },
          organization: {
            OR: [{ ownerUserId: actorUserId }, { members: { some: { id: actorUserId } } }],
          },
        },
      ],
    },
    select: { id: true },
  });
  if (!row) {
    throw new Error("Gateway not found or revoked");
  }
}

/** Alias for older call sites. */
export const assertUserOwnsGatewayToken = assertActorOwnsGatewayToken;

/** Exactly one active token in scope (personal vs org-scoped). */
export async function singleGatewayTokenIdInScope(
  userId: string,
  organizationId: string | null
): Promise<string | null> {
  const where: Prisma.AgentTokenWhereInput =
    organizationId != null
      ? { revokedAt: null, organizationId }
      : { revokedAt: null, userId, organizationId: null };
  const tokens = await db.agentToken.findMany({
    where,
    select: { id: true },
    take: 2,
  });
  if (tokens.length === 1) return tokens[0].id;
  return null;
}

/** @deprecated use singleGatewayTokenIdInScope */
export async function singleNamedGatewayTokenIdForUser(userId: string): Promise<string | null> {
  return singleGatewayTokenIdInScope(userId, null);
}

/**
 * Resolves which named gateway should execute the run (customer path).
 * - Explicit `null`: any gateway (account-wide poller or competing named gateways).
 * - Explicit string: that gateway (must be usable by this actor).
 * - `undefined`: pipeline default if valid; else org or user `defaultAgentTokenId`; else single token in scope.
 */
export async function resolveRunTargetAgentTokenId(params: {
  userId: string;
  /** Clerk-linked org workspace when in org context (session or member's `organizationId` for background jobs). */
  organizationId?: string | null;
  bodyOverride: string | null | undefined;
  pipelineDefaultId: string | null;
}): Promise<string | null> {
  const { userId, bodyOverride, pipelineDefaultId } = params;
  const organizationId = params.organizationId ?? null;

  if (bodyOverride !== undefined) {
    if (bodyOverride === null) return null;
    await assertActorOwnsGatewayToken(userId, bodyOverride);
    return bodyOverride;
  }
  if (pipelineDefaultId) {
    try {
      await assertActorOwnsGatewayToken(userId, pipelineDefaultId);
      return pipelineDefaultId;
    } catch {
      // Stored default points at a revoked or missing token.
    }
  }

  if (organizationId) {
    const org = await db.organization.findFirst({
      where: {
        id: organizationId,
        OR: [{ ownerUserId: userId }, { members: { some: { id: userId } } }],
      },
      select: { defaultAgentTokenId: true },
    });
    if (org?.defaultAgentTokenId) {
      try {
        await assertActorOwnsGatewayToken(userId, org.defaultAgentTokenId);
        return org.defaultAgentTokenId;
      } catch {
        /* fall through */
      }
    }
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { defaultAgentTokenId: true },
  });
  if (user?.defaultAgentTokenId) {
    try {
      await assertActorOwnsGatewayToken(userId, user.defaultAgentTokenId);
      return user.defaultAgentTokenId;
    } catch {
      /* fall through */
    }
  }

  return (await singleGatewayTokenIdInScope(userId, organizationId)) ?? null;
}
