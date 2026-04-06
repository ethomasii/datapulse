-- Migration: add agentToken field to User for self-hosted agent authentication
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agentToken" TEXT UNIQUE;
