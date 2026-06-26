-- Workspace MCP server registry for Genie + pipeline AI/MCP components
CREATE TABLE IF NOT EXISTS "McpServer" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "transport" TEXT NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}',
  "secrets_enc" TEXT,
  "tools_cache" JSONB,
  "tools_cached_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "McpServer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "McpServer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "McpServer_user_id_name_key" ON "McpServer"("user_id", "name");
CREATE INDEX IF NOT EXISTS "McpServer_user_id_idx" ON "McpServer"("user_id");
