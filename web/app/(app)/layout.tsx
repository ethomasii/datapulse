import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AppShell } from "@/components/layout/app-shell";
import { requireDbUser } from "@/lib/auth/server";
import { isSuperAdminClerkId } from "@/lib/auth/super-admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await requireDbUser();
  const isSuperAdmin = isSuperAdminClerkId(user.clerkId);

  return <AppShell isSuperAdmin={isSuperAdmin}>{children}</AppShell>;
}
