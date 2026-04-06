-- Migration: add Connection table for shared source/destination profiles
CREATE TABLE IF NOT EXISTS "Connection" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "connectionType" TEXT NOT NULL,
  "connector"      TEXT NOT NULL,
  "config"         JSONB NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Connection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Connection_userId_name_key" UNIQUE ("userId", "name"),
  CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Connection_userId_idx" ON "Connection"("userId");
