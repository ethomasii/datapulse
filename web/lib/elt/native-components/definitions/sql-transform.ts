import type { NativeComponentDefinition } from "../types";

export const sqlTransformComponent: NativeComponentDefinition = {
  id: "sql_transform",
  aliases: ["sql_command_job", "sql_generator"],
  name: "SQL transform",
  category: "transformation",
  description: "Run SQL statement(s) against the destination after load.",
  compileTarget: "python",
  fields: [
    {
      key: "sql",
      label: "SQL",
      description: "One or more statements separated by semicolons",
      type: "text",
      required: true,
    },
  ],
  compile(config) {
    const raw = String(config.sql ?? config.statement ?? config.query ?? "").trim();
    if (!raw) {
      return { warnings: ["sql_transform: sql is required"], sql: [] };
    }
    const statements = raw
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    return { sql: statements };
  },
};
