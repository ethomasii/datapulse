// web/lib/elt/native-components/definitions/sql-transform.ts
var sqlTransformComponent = {
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
      required: true
    }
  ],
  compile(config) {
    const raw = String(config.sql ?? config.statement ?? config.query ?? "").trim();
    if (!raw) {
      return { warnings: ["sql_transform: sql is required"], sql: [] };
    }
    const statements = raw.split(";").map((s) => s.trim()).filter(Boolean);
    return { sql: statements };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-rug7fN/sql_transform.ts
function compile(config) {
  return sqlTransformComponent.compile(config);
}
export {
  compile
};
