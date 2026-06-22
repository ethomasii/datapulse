-- Billing, security, and data-contract SLA notification triggers

ALTER TYPE "NotificationTrigger" ADD VALUE IF NOT EXISTS 'sla_at_risk';
ALTER TYPE "NotificationTrigger" ADD VALUE IF NOT EXISTS 'sla_breached';
ALTER TYPE "NotificationTrigger" ADD VALUE IF NOT EXISTS 'contract_expiring';
ALTER TYPE "NotificationTrigger" ADD VALUE IF NOT EXISTS 'catalog_contract_violated';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "known_sign_in_client_ids" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "DataContract" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);
ALTER TABLE "DataContract" ADD COLUMN IF NOT EXISTS "expiry_reminders_sent" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "DataContract" ADD COLUMN IF NOT EXISTS "last_sla_status" TEXT;

ALTER TABLE "notification_event" ADD COLUMN IF NOT EXISTS "contract_id" TEXT;
CREATE INDEX IF NOT EXISTS "notification_event_contract_id_idx" ON "notification_event"("contract_id");
