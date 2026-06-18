-- First-class workspace dbt projects (standalone + pipeline-linked).

CREATE TABLE "DbtProject" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "package_path" TEXT NOT NULL,
    "git_url" TEXT,
    "git_branch" TEXT DEFAULT 'main',
    "git_subpath" TEXT,
    "target_schema" TEXT,
    "source_slug" TEXT,
    "hub_package_key" TEXT,
    "run_scope" TEXT NOT NULL DEFAULT 'all',
    "selector" TEXT,
    "schedule_enabled" BOOLEAN NOT NULL DEFAULT false,
    "cron_schedule" TEXT,
    "schedule_timezone" TEXT NOT NULL DEFAULT 'UTC',
    "destination_connection_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DbtProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DbtProject_user_id_name_key" ON "DbtProject"("user_id", "name");
CREATE INDEX "DbtProject_user_id_idx" ON "DbtProject"("user_id");
CREATE INDEX "DbtProject_destination_connection_id_idx" ON "DbtProject"("destination_connection_id");

ALTER TABLE "DbtProject" ADD CONSTRAINT "DbtProject_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DbtProject" ADD CONSTRAINT "DbtProject_destination_connection_id_fkey" FOREIGN KEY ("destination_connection_id") REFERENCES "Connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EltPipeline" ADD COLUMN "dbt_project_id" TEXT;
CREATE INDEX "EltPipeline_dbt_project_id_idx" ON "EltPipeline"("dbt_project_id");
ALTER TABLE "EltPipeline" ADD CONSTRAINT "EltPipeline_dbt_project_id_fkey" FOREIGN KEY ("dbt_project_id") REFERENCES "DbtProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EltPipelineRun" ADD COLUMN "dbt_project_id" TEXT;
ALTER TABLE "EltPipelineRun" ALTER COLUMN "pipelineId" DROP NOT NULL;
CREATE INDEX "EltPipelineRun_dbt_project_id_startedAt_idx" ON "EltPipelineRun"("dbt_project_id", "startedAt" DESC);
ALTER TABLE "EltPipelineRun" ADD CONSTRAINT "EltPipelineRun_dbt_project_id_fkey" FOREIGN KEY ("dbt_project_id") REFERENCES "DbtProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
