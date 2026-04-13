import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organization",
};

export default function OrganizationPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Organization</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Create an organization to get an <strong className="font-medium text-slate-800 dark:text-slate-200">org-scoped
        gateway token</strong> (same API as the personal token). Poll intervals, sensor cadence, and workload lists come
        from the control plane via <code className="text-xs">GET /api/agent/manifest</code> — nothing to configure on the
        gateway except the token and base URL.
      </p>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        Billing tier (free / pro / team) sets default sensor check intervals (e.g. 10 min → 1 min on team). Optional{" "}
        <code className="text-xs">sensorPollIntervalSecondsOverride</code> on the organization record supports enterprise
        contracts (set in the database or future admin UI).
      </p>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        API: <code className="text-[11px]">GET /api/organization</code> (session) ·{" "}
        <code className="text-[11px]">POST /api/organization</code> with optional{" "}
        <code className="text-[11px]">{`{ "name": "My org" }`}</code> — returns the org gateway token once. Clerk
        organization sync can populate <code className="text-[11px]">clerkOrgId</code> later.
      </p>
    </div>
  );
}
