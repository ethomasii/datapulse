-- eltPulse cloud monitors (Neon). Apply before deploy if not using `prisma db push`.
CREATE TABLE IF NOT EXISTS "EltMonitor" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "pipelineName" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}',
  "connectionId" TEXT,
  "lastCheckAt" TIMESTAMP(3),
  "lastTriggeredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EltMonitor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EltMonitor_userId_name_key" ON "EltMonitor"("userId", "name");
CREATE INDEX IF NOT EXISTS "EltMonitor_userId_idx" ON "EltMonitor"("userId");

DO $$ BEGIN
  ALTER TABLE "EltMonitor" ADD CONSTRAINT "EltMonitor_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EltMonitor" ADD CONSTRAINT "EltMonitor_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
