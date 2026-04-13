-- Prisma one-to-one: enforce at most one User row per default gateway token id.
CREATE UNIQUE INDEX IF NOT EXISTS "User_default_agent_token_id_key" ON "User"("default_agent_token_id");
