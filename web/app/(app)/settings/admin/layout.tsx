import { notFound } from "next/navigation";
import { Shield } from "lucide-react";
import { requireDbUser } from "@/lib/auth/server";
import { isSuperAdminClerkId } from "@/lib/auth/super-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDbUser();
  if (!isSuperAdminClerkId(user.clerkId)) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-0">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          <Shield className="h-6 w-6 text-amber-600" />
          Admin Tools
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Platform-only shortcuts. Only your super-admin account sees this.
        </p>
      </div>
      <div className="pt-6">{children}</div>
    </div>
  );
}
