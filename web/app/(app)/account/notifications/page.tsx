import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notifications",
};

export default function NotificationsSettingsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Preferences</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Choose which events email you (pipeline failures, billing, security alerts). Channel toggles and digest
          frequency will be configurable here.
        </p>
        <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <li className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
            <span>Pipeline run failures</span>
            <span className="text-xs text-amber-700 dark:text-amber-400">Coming soon</span>
          </li>
          <li className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
            <span>Billing &amp; receipts</span>
            <span className="text-xs text-amber-700 dark:text-amber-400">Coming soon</span>
          </li>
          <li className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
            <span>Product updates</span>
            <span className="text-xs text-amber-700 dark:text-amber-400">Coming soon</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
