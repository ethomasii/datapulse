import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getMonthlyRowsSynced } from "@/lib/billing/report-usage";
import { PLAN_PIPELINE_LIMITS, countUserPipelines } from "@/lib/plans/limits";
import {
  API_KEY_LIMITS,
  PERSONAL_GATEWAY_LIMITS,
  RUN_HISTORY_DAYS,
  tierAllowsColumnLineage,
  tierAllowsCustomerGateway,
  tierAllowsGitArtifactExport,
  tierAllowsOrgGatewayTokens,
  tierAllowsOrgInvites,
  tierAllowsRunsApi,
  tierAllowsWebhookTriggers,
} from "@/lib/plans/tier-features";
import {
  airGappedMetadataEnabled,
  ssoFeatureEnabled,
  tierCanUseSso,
  tierEligibleForSso,
} from "@/lib/plans/roadmap-features";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = user.subscription?.tier ?? "free";
  const [pipelineCount, rowsThisMonth] = await Promise.all([
    countUserPipelines(user.id),
    getMonthlyRowsSynced(user.id),
  ]);

  const pipelineLimit = PLAN_PIPELINE_LIMITS[tier];

  return NextResponse.json({
    tier,
    status: user.subscription?.status ?? "active",
    stripeCustomerId: user.subscription?.stripeCustomerId ?? null,
    currentPeriodEnd: user.subscription?.currentPeriodEnd ?? null,
    usage: {
      pipelines: pipelineCount,
      pipelineLimit,
      rowsSyncedThisMonth: rowsThisMonth,
    },
    features: {
      portal: Boolean(user.subscription?.stripeCustomerId),
      usageMeter: Boolean(process.env.STRIPE_USAGE_METER_EVENT_NAME),
      customerGateway: tierAllowsCustomerGateway(tier),
      webhookTriggers: tierAllowsWebhookTriggers(tier),
      gitArtifactExport: tierAllowsGitArtifactExport(tier),
      columnLineage: tierAllowsColumnLineage(tier),
      runsApi: tierAllowsRunsApi(tier),
      orgInvites: tierAllowsOrgInvites(tier),
      orgGateways: tierAllowsOrgGatewayTokens(tier),
      runHistoryDays: RUN_HISTORY_DAYS[tier],
      apiKeyLimit: API_KEY_LIMITS[tier],
      personalGatewayLimit: PERSONAL_GATEWAY_LIMITS[tier],
      ssoEligible: tierEligibleForSso(tier),
      ssoActive: tierCanUseSso(tier),
      ssoConfigured: ssoFeatureEnabled(),
      airGappedMetadataConfigured: airGappedMetadataEnabled(),
    },
  });
}
