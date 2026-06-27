import { requireDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { resolveUserPlanTier } from "@/lib/plans/tier-features";
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
  const effectiveTier = await resolveUserPlanTier(user.id);

  const prefs = await db.notificationPreference.findMany({ where: { userId: user.id } });
  const prefMap = Object.fromEntries(prefs.map((p) => [p.channel, p])) as Partial<
    Record<NotificationChannel, (typeof prefs)[0] | null>
  >;

  return (
    <NotificationSettingsForm
      userEmail={user.email}
      prefs={prefMap}
      access={{
        email: canAccessEmailNotifications(user.subscription, effectiveTier),
        slack: canAccessSlackNotifications(user.subscription, effectiveTier),
        teams: canAccessTeamsNotifications(user.subscription, effectiveTier),
        discord: canAccessDiscordNotifications(user.subscription, effectiveTier),
        pagerduty: canAccessPagerDutyNotifications(user.subscription, effectiveTier),
        webhook: canAccessWebhookNotifications(user.subscription, effectiveTier),
        googlechat: canAccessWebhookNotifications(user.subscription, effectiveTier),
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
