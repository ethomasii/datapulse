import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notification history",
};

export default function NotificationHistoryPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Sent notifications</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        A chronological list of emails and in-app notifications (with status: sent, bounced, opened when available).
        Pairs with Resend or your mail provider once delivery is instrumented.
      </p>
      <div className="mt-8 rounded-lg border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-500">
        No notifications recorded yet.
      </div>
    </div>
  );
}
