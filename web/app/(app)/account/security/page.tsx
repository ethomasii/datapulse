import type { Metadata } from "next";
import { requireDbUser } from "@/lib/auth/server";
import { getActiveOrganizationForSession } from "@/lib/auth/active-org";
import { SecuritySettingsClient } from "@/components/account/security-settings-client";
import { isEnterpriseOrganization } from "@/lib/plans/roadmap-features";

export const metadata: Metadata = {
  title: "Security",
};

export default async function SecurityPage() {
  const user = await requireDbUser();
  const tier = user.subscription?.tier ?? "free";
  const sessionOrg = await getActiveOrganizationForSession();

  return (
    <SecuritySettingsClient tier={tier} enterpriseOrg={isEnterpriseOrganization(sessionOrg?.id)} />
  );
}
