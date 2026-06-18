ALTER TABLE "CatalogAssetComment" ADD COLUMN IF NOT EXISTS "slack_channel" TEXT;
ALTER TABLE "CatalogAssetComment" ADD COLUMN IF NOT EXISTS "slack_ts" TEXT;
