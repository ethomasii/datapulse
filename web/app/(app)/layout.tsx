import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AppShell } from "@/components/layout/app-shell";
import { requireDbUser } from "@/lib/auth/server";
import { isSuperAdminClerkId } from "@/lib/auth/super-admin";
import { canAccessAiAssistant, getEffectiveTier } from "@/lib/plans/plan-enforcement";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await requireDbUser();
  const isSuperAdmin = isSuperAdminClerkId(user.clerkId);
  const effectiveTier = getEffectiveTier(user.subscription);
  const aiAccess = canAccessAiAssistant(user.subscription, effectiveTier);

  return (
    <AppShell
      isSuperAdmin={isSuperAdmin}
      planTier={effectiveTier}
      showAiAssistant={aiAccess.allowed}
      aiUpgradeReason={aiAccess.reason}
    >
      {children}
    </AppShell>
  );
}
