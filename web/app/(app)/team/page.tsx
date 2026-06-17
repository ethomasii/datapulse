import type { Metadata } from "next";
import { TeamClient } from "@/components/account/team-client";

export const metadata: Metadata = {
  title: "Team",
};

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Collaboration</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Team</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Invite colleagues into your organization workspace. Members see shared pipelines, runs, and connections
          owned by the organization.
        </p>
      </div>
      <TeamClient />
    </div>
  );
}
