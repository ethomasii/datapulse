import { requireDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { NotificationSettingsForm } from "@/components/account/notification-settings-form";
import {
  canAccessDiscordNotifications,
  canAccessEmailNotifications,
  canAccessPagerDutyNotifications,
  canAccessSlackNotifications,
  canAccessTeamsNotifications,
  canAccessWebhookNotifications,
} from "@/lib/plans/notification-access";
import type { NotificationChannel } from "@prisma/client";

export const revalidate = 0;

export default async function NotificationsSettingsPage() {
  const user = await requireDbUser();

  const prefs = await db.notificationPreference.findMany({ where: { userId: user.id } });
  const prefMap = Object.fromEntries(prefs.map((p) => [p.channel, p])) as Partial<
    Record<NotificationChannel, (typeof prefs)[0] | null>
  >;

  return (
    <NotificationSettingsForm
      userEmail={user.email}
      prefs={prefMap}
      access={{
        email: canAccessEmailNotifications(user.subscription),
        slack: canAccessSlackNotifications(user.subscription),
        teams: canAccessTeamsNotifications(user.subscription),
        discord: canAccessDiscordNotifications(user.subscription),
        pagerduty: canAccessPagerDutyNotifications(user.subscription),
        webhook: canAccessWebhookNotifications(user.subscription),
        googlechat: canAccessWebhookNotifications(user.subscription),
      }}
      delivery={{
        quietHoursEnabled: user.notificationQuietHoursEnabled,
        quietStart: user.notificationQuietStart ?? "22:00",
        quietEnd: user.notificationQuietEnd ?? "08:00",
        quietTimezone: user.notificationQuietTimezone ?? user.timezone,
      }}
    />
  );
}
