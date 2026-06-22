-- Organization dedicated managed compute + run workspace routing

CREATE TYPE "ManagedComputeMode" AS ENUM ('shared', 'dedicated');

ALTER TABLE "Organization"
  ADD COLUMN "managed_compute_mode" "ManagedComputeMode" NOT NULL DEFAULT 'shared',
  ADD COLUMN "managed_worker_batch_url" TEXT;

CREATE INDEX "Organization_managed_compute_mode_idx" ON "Organization"("managed_compute_mode");

ALTER TABLE "EltPipelineRun"
  ADD COLUMN "workspace_organization_id" TEXT;

ALTER TABLE "EltPipelineRun"
  ADD CONSTRAINT "EltPipelineRun_workspace_organization_id_fkey"
  FOREIGN KEY ("workspace_organization_id") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "EltPipelineRun_workspace_organization_id_status_idx"
  ON "EltPipelineRun"("workspace_organization_id", "status");
