-- Add incoming webhook token column to User table
-- Run this against your database before deploying the feature.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "incomingWebhookToken" TEXT UNIQUE;
