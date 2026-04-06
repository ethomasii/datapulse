import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audit log",
};

export default function AuditLogPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Activity</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Immutable record of security-relevant actions: sign-ins, pipeline changes, integration connects, billing
        updates, and API key usage. Export to CSV for compliance when the backend is connected.
      </p>
      <div className="mt-8 overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50">
            <tr>
              <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">Time</th>
              <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">Actor</th>
              <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3} className="px-4 py-12 text-center text-slate-500 dark:text-slate-500">
                Audit logging is not enabled yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
