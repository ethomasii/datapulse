-- Workspace API keys and organization invites

CREATE TABLE "workspace_api_key" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['pipelines:read', 'pipelines:write', 'runs:read', 'runs:write', 'connections:read', 'connections:write']::TEXT[],
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_api_key_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_api_key_key_hash_key" ON "workspace_api_key"("key_hash");
CREATE INDEX "workspace_api_key_user_id_idx" ON "workspace_api_key"("user_id");

ALTER TABLE "workspace_api_key" ADD CONSTRAINT "workspace_api_key_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "organization_invite" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "organization_invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_invite_organization_id_email_key" ON "organization_invite"("organization_id", "email");
CREATE INDEX "organization_invite_organization_id_idx" ON "organization_invite"("organization_id");

ALTER TABLE "organization_invite" ADD CONSTRAINT "organization_invite_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
