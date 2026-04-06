import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organization",
};

export default function OrganizationPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Workspace</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        When Clerk Organizations (or equivalent) are enabled, this tab will hold org name, members, roles, and which
        pipelines belong to the workspace. Billing may move to org-level for Team plans.
      </p>
      <div className="mt-8 rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-700">
        Personal workspace only — organization features are on the roadmap.
      </div>
    </div>
  );
}
