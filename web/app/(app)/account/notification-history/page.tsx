import { requireDbUser } from "@/lib/auth/server";
import { listNotificationEvents } from "@/lib/notifications/dispatch";
import { NotificationHistoryClient } from "@/components/account/notification-history-client";

export const revalidate = 0;

export default async function NotificationHistoryPage() {
  const user = await requireDbUser();
  const events = await listNotificationEvents(user.id, 100);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Delivery log for every channel — sent, failed, skipped (quiet hours), or pending retry.
      </p>
      <NotificationHistoryClient
        events={events.map((e) => ({
          id: e.id,
          createdAt: e.createdAt.toISOString(),
          channel: e.channel,
          trigger: e.trigger,
          subject: e.subject,
          statusCode: e.statusCode,
          nextRetryAt: e.nextRetryAt?.toISOString() ?? null,
          lastAttemptAt: e.lastAttemptAt?.toISOString() ?? null,
          retryCount: e.retryCount,
          responseBody: e.responseBody,
          skipReason: e.skipReason,
          sentAt: e.sentAt?.toISOString() ?? null,
          error: e.error,
        }))}
      />
    </div>
  );
}
