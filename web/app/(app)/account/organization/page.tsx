import { OrganizationClient } from "@/components/account/organization-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organization",
};

export default function OrganizationPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Organization</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Shared workspace — org name, gateway token defaults, and component catalog. Invite members on Team.
      </p>
      <div className="mt-6">
        <OrganizationClient />
      </div>
    </div>
  );
}
