-- Optional migration: encrypted connection secrets (AES-256-GCM blob) for SaaS + agent runners.
ALTER TABLE "Connection" ADD COLUMN IF NOT EXISTS "connection_secrets_enc" TEXT;
