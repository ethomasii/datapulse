-- Allow users to dismiss the onboarding checklist on the dashboard.
ALTER TABLE "User" ADD COLUMN "onboarding_dismissed_at" TIMESTAMP(3);
