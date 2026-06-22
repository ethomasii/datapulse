import type { ManagedComputeMode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import {
  dedicatedComputeBillingConfigured,
  dedicatedComputePricingSummary,
  formatDedicatedComputePlatformFee,
} from "@/lib/billing/dedicated-compute-pricing";
import {
  getDedicatedComputeBilling,
  orgCanUseDedicatedManagedCompute,
} from "@/lib/billing/dedicated-compute-subscription";
import {
  getOrgManagedComputeStatus,
  managedComputeCustomerLabel,
} from "@/lib/elt/org-managed-compute";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import { tierEligibleForDedicatedComputePurchase } from "@/lib/plans/org-dedicated-compute-tier";

const patchSchema = z.object({
  managedComputeMode: z.enum(["shared", "dedicated"]).optional(),
  /** eltPulse ops / enterprise onboarding — optional worker batch URL. */
  managedWorkerBatchUrl: z.string().url().nullable().optional(),
});

async function ownedOrganization(userId: string) {
  return db.organization.findUnique({
    where: { ownerUserId: userId },
    select: { id: true, ownerUserId: true },
  });
}

async function ownerPlanTier(ownerUserId: string) {
  const sub = await db.subscription.findUnique({
    where: { userId: ownerUserId },
    select: { tier: true },
  });
  return sub?.tier ?? "free";
}

/** GET /api/organization/managed-compute — org dedicated compute status (owner). */
export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await ownedOrganization(user.id);
  if (!org) return NextResponse.json({ organization: null });

  try {
    const status = await getOrgManagedComputeStatus(org.id);
    const tier = await ownerPlanTier(org.ownerUserId);
    const billing = await getDedicatedComputeBilling(org.id);
    const canPurchase = tierEligibleForDedicatedComputePurchase(tier);
    const subscribed = Boolean(billing?.subscribed);

    return NextResponse.json({
      organizationId: org.id,
      canPurchaseDedicated: canPurchase,
      canEnableDedicated: subscribed,
      planTier: tier,
      billing: billing
        ? {
            subscribed: billing.subscribed,
            status: billing.status,
            currentPeriodEnd: billing.currentPeriodEnd?.toISOString() ?? null,
          }
        : null,
      pricing: {
        platformFeeLabel: formatDedicatedComputePlatformFee(),
        summary: dedicatedComputePricingSummary(),
        checkoutConfigured: dedicatedComputeBillingConfigured(),
      },
      status,
      label: status ? managedComputeCustomerLabel(status) : null,
    });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}

/** PATCH — ops worker URL, or revert to shared (billing cancellation handled via Stripe). */
export async function PATCH(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getWorkspacePermissions(user.id);
  if (!perms.canManageBilling && perms.role !== "owner") {
    return NextResponse.json(
      { error: "Only the organization owner can change compute settings." },
      { status: 403 }
    );
  }

  const org = await ownedOrganization(user.id);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.managedComputeMode === "dedicated") {
    const tier = await ownerPlanTier(org.ownerUserId);
    if (!tierEligibleForDedicatedComputePurchase(tier)) {
      return NextResponse.json(
        {
          error: "Dedicated managed compute requires a Team workspace plan first.",
          code: "team_plan_required",
        },
        { status: 403 }
      );
    }
    const allowed = await orgCanUseDedicatedManagedCompute(org.id);
    if (!allowed) {
      return NextResponse.json(
        {
          error: `Dedicated managed compute is a paid add-on (${dedicatedComputePricingSummary()}). Subscribe under Team or Billing.`,
          code: "subscription_required",
          pricing: {
            platformFeeLabel: formatDedicatedComputePlatformFee(),
            summary: dedicatedComputePricingSummary(),
          },
        },
        { status: 402 }
      );
    }
  }

  const data: {
    managedComputeMode?: ManagedComputeMode;
    managedWorkerBatchUrl?: string | null;
  } = {};

  if (parsed.data.managedComputeMode !== undefined) {
    data.managedComputeMode = parsed.data.managedComputeMode;
  }
  if (parsed.data.managedWorkerBatchUrl !== undefined) {
    data.managedWorkerBatchUrl = parsed.data.managedWorkerBatchUrl;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes requested" }, { status: 400 });
  }

  try {
    await db.organization.update({
      where: { id: org.id },
      data,
    });
    const status = await getOrgManagedComputeStatus(org.id);
    return NextResponse.json({
      ok: true,
      status,
      label: status ? managedComputeCustomerLabel(status) : null,
    });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
