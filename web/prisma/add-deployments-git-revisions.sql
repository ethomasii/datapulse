-- Workspace deployments, pipeline bindings, revisions, GitHub dev branch
-- Run from web/: npx prisma db push  OR apply manually on Neon

ALTER TABLE "GithubConnection" ADD COLUMN IF NOT EXISTS "development_branch" TEXT DEFAULT 'develop';

CREATE TABLE IF NOT EXISTS "WorkspaceDeployment" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "env_overrides_enc" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceDeployment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceDeployment_user_id_slug_key" ON "WorkspaceDeployment"("user_id", "slug");
CREATE INDEX IF NOT EXISTS "WorkspaceDeployment_user_id_idx" ON "WorkspaceDeployment"("user_id");

CREATE TABLE IF NOT EXISTS "PipelineDeploymentBinding" (
  "id" TEXT NOT NULL,
  "pipeline_id" TEXT NOT NULL,
  "deployment_id" TEXT NOT NULL,
  "source_connection_id" TEXT,
  "destination_connection_id" TEXT,
  CONSTRAINT "PipelineDeploymentBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PipelineDeploymentBinding_pipeline_id_deployment_id_key"
  ON "PipelineDeploymentBinding"("pipeline_id", "deployment_id");
CREATE INDEX IF NOT EXISTS "PipelineDeploymentBinding_pipeline_id_idx" ON "PipelineDeploymentBinding"("pipeline_id");

CREATE TABLE IF NOT EXISTS "PipelineRevision" (
  "id" TEXT NOT NULL,
  "pipeline_id" TEXT NOT NULL,
  "declarative_spec_yaml" TEXT NOT NULL,
  "message" TEXT,
  "git_commit_sha" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PipelineRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PipelineRevision_pipeline_id_created_at_idx" ON "PipelineRevision"("pipeline_id", "created_at");
