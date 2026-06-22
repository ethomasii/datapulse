import type { Metadata } from "next";
import { TeamClient } from "@/components/account/team-client";

export const metadata: Metadata = {
  title: "Team",
};

export default function AccountTeamPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Team</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Invite colleagues, manage roles, and configure dedicated managed compute for your organization workspace.
      </p>
      <div className="mt-6">
        <TeamClient />
      </div>
    </div>
  );
}
