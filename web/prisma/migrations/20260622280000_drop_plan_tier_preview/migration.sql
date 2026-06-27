-- Revert unused plan_tier_preview column (replaced by ServicePulse-style DB tier switcher).
ALTER TABLE "User" DROP COLUMN IF EXISTS "plan_tier_preview";
