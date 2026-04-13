/**
 * Named agent connectors — multiple Bearer tokens per user (per cloud, on-prem, etc.).
 *
 * GET  — session: personal connectors; when in an org workspace, also `organizationConnectors` + org default id
 * POST — session: `{ name, metadata?, organizationId? }` — org-scoped tokens require Pro/Team on the org owner
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getActiveOrganizationForSession } from "@/lib/auth/active-org";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { tierAllowsOrgGatewayTokens } from "@/lib/plans/org-gateway-tier";

export const dynamic = "force-dynamic";

function generateToken(): string {
  const buf = new Uint8Array(48);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.agentToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      metadata: true,
      lastSeenAt: true,
      lastSeenVersion: true,
      lastSeenLabels: true,
      lastSeenSource: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    connectors: rows.map((r) => ({
      id: r.id,
      name: r.name,
      metadata: r.metadata,
      lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
      lastSeenVersion: r.lastSeenVersion,
      lastSeenSource: r.lastSeenSource,
      createdAt: r.createdAt.toISOString(),
    })),
    accountToken: Boolean(user.agentToken),
    defaultAgentTokenId: user.defaultAgentTokenId,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; metadata?: unknown; organizationId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) {
    return NextResponse.json({ error: "name is required (max 120 chars)" }, { status: 400 });
  }

  let metadata: Prisma.InputJsonValue = {};
  if (body.metadata !== undefined) {
    if (body.metadata === null || typeof body.metadata !== "object" || Array.isArray(body.metadata)) {
      return NextResponse.json({ error: "metadata must be a JSON object when provided" }, { status: 400 });
    }
    metadata = body.metadata as Prisma.InputJsonValue;
  }

  const orgIdRaw = typeof body.organizationId === "string" ? body.organizationId.trim() : "";
  let ownerUserId = user.id;
  let organizationId: string | null = null;
  if (orgIdRaw) {
    const org = await db.organization.findFirst({
      where: {
        id: orgIdRaw,
        OR: [{ ownerUserId: user.id }, { members: { some: { id: user.id } } }],
      },
      select: {
        id: true,
        ownerUserId: true,
        owner: { select: { subscription: { select: { tier: true } } } },
      },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found or access denied" }, { status: 403 });
    }
    const tier = org.owner.subscription?.tier ?? "free";
    if (!tierAllowsOrgGatewayTokens(tier)) {
      return NextResponse.json(
        { error: "Org-scoped gateways require Pro or Team on the organization owner." },
        { status: 403 }
      );
    }
    ownerUserId = org.ownerUserId;
    organizationId = org.id;
  }

  const token = generateToken();
  const row = await db.agentToken.create({
    data: {
      userId: ownerUserId,
      organizationId,
      name,
      token,
      metadata,
    },
    select: { id: true, name: true },
  });

  if (organizationId === null) {
    const activeAfter = await db.agentToken.count({
      where: { userId: user.id, organizationId: null, revokedAt: null },
    });
    if (activeAfter === 1) {
      await db.user.update({
        where: { id: user.id },
        data: { defaultAgentTokenId: row.id },
      });
    }
  }

  return NextResponse.json({
    connector: row,
    token,
    message: "Store this token securely — it is only shown once.",
  });
}
