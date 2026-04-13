/**
 * Resolves the acting User + plan from a Bearer token.
 * Lookup order: named `AgentToken` → account-wide `User.agentToken` → `Organization.agentToken` (owner).
 */
import type { AgentToken, Organization, PlanTier, Subscription, User } from "@prisma/client";
import { db } from "@/lib/db/client";

export type AgentAuthContext = {
  user: User;
  subscription: Subscription | null;
  organization: Organization | null;
  planTier: PlanTier;
  /** When set, heartbeat updates this row instead of the account-wide `User` heartbeat columns. */
  agentTokenRow: (AgentToken & { revokedAt: Date | null }) | null;
};

export async function getAgentAuthContext(req: Request): Promise<AgentAuthContext | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  const named = await db.agentToken.findUnique({
    where: { token },
    include: { user: { include: { subscription: true } } },
  });
  if (named && !named.revokedAt) {
    const tier = named.user.subscription?.tier ?? "free";
    return {
      user: named.user,
      subscription: named.user.subscription,
      organization: null,
      planTier: tier,
      agentTokenRow: named,
    };
  }

  const org = await db.organization.findUnique({
    where: { agentToken: token },
    include: { owner: { include: { subscription: true } } },
  });
  if (org?.owner) {
    const tier = org.owner.subscription?.tier ?? "free";
    return {
      user: org.owner,
      subscription: org.owner.subscription,
      organization: org,
      planTier: tier,
      agentTokenRow: null,
    };
  }

  const user = await db.user.findUnique({
    where: { agentToken: token },
    include: { subscription: true },
  });
  if (!user) return null;
  const tier = user.subscription?.tier ?? "free";
  return {
    user,
    subscription: user.subscription,
    organization: null,
    planTier: tier,
    agentTokenRow: null,
  };
}

/** Backward-compatible: returns the acting user (org owner when using org token). */
export async function getUserFromAgentToken(req: Request) {
  const ctx = await getAgentAuthContext(req);
  return ctx?.user ?? null;
}
