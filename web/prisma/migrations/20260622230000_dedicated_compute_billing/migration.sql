-- Dedicated managed compute billing (paid add-on, separate from Team plan)

ALTER TABLE "Organization"
  ADD COLUMN "dedicated_compute_stripe_subscription_id" TEXT,
  ADD COLUMN "dedicated_compute_subscription_status" "SubscriptionStatus",
  ADD COLUMN "dedicated_compute_current_period_end" TIMESTAMP(3);

CREATE UNIQUE INDEX "Organization_dedicated_compute_stripe_subscription_id_key"
  ON "Organization"("dedicated_compute_stripe_subscription_id");
