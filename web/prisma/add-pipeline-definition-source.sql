-- Pipeline definition source (Neon vs Git) + personal dev branches for teams
-- Run from web/: npx prisma db push

CREATE TYPE "PipelineDefinitionSource" AS ENUM ('neon', 'git');

ALTER TABLE "GithubConnection" ADD COLUMN IF NOT EXISTS "production_definition_source" "PipelineDefinitionSource" NOT NULL DEFAULT 'neon';
ALTER TABLE "GithubConnection" ADD COLUMN IF NOT EXISTS "development_definition_source" "PipelineDefinitionSource" NOT NULL DEFAULT 'neon';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "personal_dev_branch" TEXT;
