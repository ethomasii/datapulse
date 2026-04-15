-- Where cloud cron vs customer gateway evaluates each monitor (same enum as pipelines).

ALTER TABLE "EltMonitor" ADD COLUMN IF NOT EXISTS "execution_host" "PipelineExecutionHost" NOT NULL DEFAULT 'inherit';
