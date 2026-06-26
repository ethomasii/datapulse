#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClientFromEnv } from "./client.js";
import { createEltPulseMcpServer } from "./server.js";

async function main() {
  if (!process.env.ELTPULSE_API_TOKEN && !process.env.ELTPULSE_API_KEY) {
    console.error(
      "Missing ELTPULSE_API_TOKEN. Create a workspace API key at Account → Developers (elt_...)."
    );
    process.exit(1);
  }

  const client = createClientFromEnv();
  const server = createEltPulseMcpServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
