import type { Metadata } from "next";
import { AuditLogClient } from "@/components/account/audit-log-client";

export const metadata: Metadata = {
  title: "Audit log",
};

export default function AuditLogPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Activity</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Immutable record of security-relevant actions in your workspace — organization changes, team invites, and API
        key lifecycle. Export to CSV for compliance reviews.
      </p>
      <div className="mt-6">
        <AuditLogClient />
      </div>
    </div>
  );
}
