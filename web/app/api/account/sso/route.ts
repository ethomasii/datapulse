import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import {
  clerkEnterpriseConnectionConfigured,
  clerkEnterpriseSsoReady,
  CLERK_SSO_DOCS_URL,
  CLERK_DASHBOARD_URL,
  ssoSetupInstructionsForTeam,
} from "@/lib/clerk/sso";
import { tierCanUseSso, tierEligibleForSso } from "@/lib/plans/roadmap-features";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = user.subscription?.tier ?? "free";
  const eligible = tierEligibleForSso(tier);
  const active = tierCanUseSso(tier);
  const clerkReady = clerkEnterpriseSsoReady();
  const connectionConfigured = clerkEnterpriseConnectionConfigured();

  return NextResponse.json({
    tier,
    eligible,
    active,
    clerkReady,
    connectionConfigured,
    instructions: eligible ? ssoSetupInstructionsForTeam() : null,
    clerkDashboardUrl: CLERK_DASHBOARD_URL,
    clerkSsoDocsUrl: CLERK_SSO_DOCS_URL,
    signInUrl: "/sign-in",
  });
}
