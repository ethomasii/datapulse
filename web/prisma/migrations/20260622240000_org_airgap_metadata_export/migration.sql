-- Air-gap v1: org metadata export webhook + run export tracking

CREATE TYPE "MetadataStorageMode" AS ENUM ('cloud', 'customer_export');

ALTER TABLE "Organization"
  ADD COLUMN "metadata_storage_mode" "MetadataStorageMode" NOT NULL DEFAULT 'cloud',
  ADD COLUMN "metadata_export_webhook_url" TEXT,
  ADD COLUMN "metadata_export_webhook_secret" TEXT;

ALTER TABLE "EltPipelineRun"
  ADD COLUMN "airgap_exported_at" TIMESTAMP(3),
  ADD COLUMN "airgap_export_status" TEXT;
