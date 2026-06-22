-- Notification preferences + delivery history (ServicePulse-style multi-channel)

CREATE TYPE "NotificationChannel" AS ENUM (
  'email',
  'slack',
  'teams',
  'discord',
  'pagerduty',
  'webhook',
  'googlechat',
  'zapier',
  'make',
  'n8n',
  'pipedream'
);

CREATE TYPE "NotificationTrigger" AS ENUM (
  'run_succeeded',
  'run_failed',
  'run_cancelled',
  'alert_rule_fired',
  'pipeline_created',
  'pipeline_deleted',
  'billing_payment_failed',
  'security_new_device'
);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notification_quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notification_quiet_start" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notification_quiet_end" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notification_quiet_timezone" TEXT;

CREATE TABLE "notification_preference" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "email_address" TEXT,
  "slack_webhook_url" TEXT,
  "teams_webhook_url" TEXT,
  "discord_webhook_url" TEXT,
  "pagerduty_routing_key" TEXT,
  "webhook_url" TEXT,
  "webhook_secret" TEXT,
  "webhook_payload_template" TEXT,
  "googlechat_webhook_url" TEXT,
  "zapier_webhook_url" TEXT,
  "make_webhook_url" TEXT,
  "n8n_webhook_url" TEXT,
  "pipedream_webhook_url" TEXT,
  "triggers" "NotificationTrigger"[] DEFAULT ARRAY[]::"NotificationTrigger"[],
  "pipeline_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_event" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "run_id" TEXT,
  "pipeline_id" TEXT,
  "channel" "NotificationChannel" NOT NULL,
  "trigger" "NotificationTrigger" NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sent_at" TIMESTAMP(3),
  "error" TEXT,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "next_retry_at" TIMESTAMP(3),
  "last_attempt_at" TIMESTAMP(3),
  "status_code" INTEGER,
  "response_body" TEXT,
  "skip_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_preference_user_id_channel_key" ON "notification_preference"("user_id", "channel");
CREATE INDEX "notification_preference_user_id_idx" ON "notification_preference"("user_id");
CREATE INDEX "notification_event_user_id_created_at_idx" ON "notification_event"("user_id", "created_at" DESC);
CREATE INDEX "notification_event_run_id_idx" ON "notification_event"("run_id");

ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_event" ADD CONSTRAINT "notification_event_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
