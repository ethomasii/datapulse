/**
 * GET /api/organization/metadata-export — org owner: air-gap metadata export settings
 * PATCH — update mode + webhook URL (Team preview / Enterprise)
 * POST { action: "test" } — send connectivity test payload
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import {
  loadAirgapOrgConfig,
  sendAirgapExportTest,
} from "@/lib/elt/airgap-metadata-export";
import { resolveUserPlanTier } from "@/lib/plans/tier-features";
import { orgCanUseAirGappedMetadata } from "@/lib/plans/roadmap-features";

async function ownedOrg(userId: string) {
  return db.organization.findUnique({
    where: { ownerUserId: userId },
    select: {
      id: true,
      name: true,
      metadataStorageMode: true,
      metadataExportWebhookUrl: true,
      metadataExportWebhookSecret: true,
    },
  });
}

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await ownedOrg(user.id);
  if (!org) {
    return NextResponse.json({ organization: null, allowed: false });
  }

  const tier = await resolveUserPlanTier(user.id);
  const allowed = orgCanUseAirGappedMetadata(org.id, tier);

  return NextResponse.json({
    organizationId: org.id,
    allowed,
    metadataStorageMode: org.metadataStorageMode,
    hasWebhookUrl: Boolean(org.metadataExportWebhookUrl),
    hasWebhookSecret: Boolean(org.metadataExportWebhookSecret),
    webhookUrlPreview: org.metadataExportWebhookUrl
      ? `${org.metadataExportWebhookUrl.slice(0, 32)}…`
      : null,
  });
}

const patchSchema = z.object({
  metadataStorageMode: z.enum(["cloud", "customer_export"]).optional(),
  metadataExportWebhookUrl: z.string().url().nullable().optional(),
  metadataExportWebhookSecret: z.string().min(8).max(256).nullable().optional(),
  clearWebhookSecret: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await ownedOrg(user.id);
  if (!org) {
    return NextResponse.json({ error: "Create an organization first" }, { status: 400 });
  }

  const tier = await resolveUserPlanTier(user.id);
  if (!orgCanUseAirGappedMetadata(org.id, tier)) {
    return NextResponse.json(
      {
        error:
          "Air-gapped metadata export requires Team (preview) or Enterprise. Contact hello@eltpulse.dev to enable.",
      },
      { status: 403 }
    );
  }

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

  const data: {
    metadataStorageMode?: "cloud" | "customer_export";
    metadataExportWebhookUrl?: string | null;
    metadataExportWebhookSecret?: string | null;
  } = {};

  if (parsed.data.metadataStorageMode) {
    data.metadataStorageMode = parsed.data.metadataStorageMode;
  }
  if (parsed.data.metadataExportWebhookUrl !== undefined) {
    data.metadataExportWebhookUrl = parsed.data.metadataExportWebhookUrl;
  }
  if (parsed.data.clearWebhookSecret) {
    data.metadataExportWebhookSecret = null;
  } else if (parsed.data.metadataExportWebhookSecret !== undefined) {
    data.metadataExportWebhookSecret = parsed.data.metadataExportWebhookSecret;
  }

  if (data.metadataStorageMode === "customer_export" && !org.metadataExportWebhookUrl && !data.metadataExportWebhookUrl) {
    return NextResponse.json(
      { error: "Set metadataExportWebhookUrl before enabling customer_export mode." },
      { status: 400 }
    );
  }

  const updated = await db.organization.update({
    where: { id: org.id },
    data,
    select: {
      metadataStorageMode: true,
      metadataExportWebhookUrl: true,
      metadataExportWebhookSecret: true,
    },
  });

  return NextResponse.json({
    ok: true,
    metadataStorageMode: updated.metadataStorageMode,
    hasWebhookUrl: Boolean(updated.metadataExportWebhookUrl),
    hasWebhookSecret: Boolean(updated.metadataExportWebhookSecret),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await ownedOrg(user.id);
  if (!org) return NextResponse.json({ error: "Organization required" }, { status: 400 });

  const tier = await resolveUserPlanTier(user.id);
  if (!orgCanUseAirGappedMetadata(org.id, tier)) {
    return NextResponse.json({ error: "Not enabled for this workspace" }, { status: 403 });
  }

  let action = "test";
  try {
    const body = (await req.json()) as { action?: string };
    if (typeof body.action === "string") action = body.action;
  } catch {
    /* default test */
  }

  if (action !== "test") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const config = await loadAirgapOrgConfig(org.id);
  if (!config) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const result = await sendAirgapExportTest(config);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Test failed", httpStatus: result.httpStatus }, { status: 502 });
  }

  return NextResponse.json({ ok: true, httpStatus: result.httpStatus });
}
