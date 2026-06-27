import type { NativeComponentDefinition, NativeComponentField } from "./types";

function sampleString(key: string, field: NativeComponentField): string {
  const k = key.toLowerCase();
  if (k.includes("schema") && field.type === "text") return '{"type":"object","properties":{"id":{"type":"string"}}}';
  if (k.includes("sql")) return "SELECT 1";
  if (k.includes("url") || k.includes("endpoint")) return "https://example.com/data";
  if (k.includes("bucket")) return "my-bucket";
  if (k.includes("queue")) return "https://sqs.us-east-1.amazonaws.com/123456789/my-queue";
  if (k.includes("bootstrap")) return "localhost:9092";
  if (k.includes("topic")) return "events";
  if (k.includes("group")) return "consumer-grp";
  if (k.includes("spreadsheet")) return "sheet-id";
  if (k.includes("connection")) return "mongodb://localhost:27017";
  if (k.includes("database")) return "analytics";
  if (k.includes("collection")) return "events";
  if (k.includes("path") || k.includes("prefix")) return "incoming/";
  if (k.includes("glob")) return "**/*";
  if (k.includes("message")) return "payload";
  if (k.includes("xpath")) return "//record";
  if (k.includes("regex")) return ".*";
  if (k.includes("delimiter")) return ",";
  if (k.includes("format")) return "%Y-%m-%d";
  if (k.includes("expression") || k.includes("formula")) return "1 + 1";
  if (k.includes("output") || k.endsWith("_table") || k === "table") return "staging.t";
  if (k.includes("left")) return "staging.left";
  if (k.includes("right") || k.includes("lookup") || k.includes("dimension")) return "staging.right";
  if (k.includes("staging")) return "staging.s";
  if (k.includes("column") || k.includes("watermark") || k.includes("timestamp")) return "updated_at";
  if (k.includes("name") || k.includes("label")) return "sample";
  return "x";
}

function sampleValue(field: NativeComponentField): unknown {
  if (field.default !== undefined) return field.default;
  const k = field.key.toLowerCase();

  if (k === "tables") return ["staging.a", "staging.b"];
  if (k === "mapping" && field.description?.includes("Column →")) {
    return '{"status":{"pending":"open"}}';
  }
  if (k === "mapping" || k === "column_mapping" || k === "rename_map") {
    return '{"id":"order_id"}';
  }
  if (k === "aggregations") return '{"amount":"sum","id":"count"}';
  if (k === "values" || k === "fillna") return '{"status":"unknown","amount":0}';
  if (k === "paths" || k === "field_paths" || k === "xpath_mappings") {
    return '{"user.email":"email"}';
  }
  if (k === "routes" || k === "outputs") {
    return '[{"condition":"status == \\"active\\"","output_table":"staging.active_rows"}]';
  }
  if (k === "policies" || k === "masking_rules") {
    return '{"email":{"method":"hash"}}';
  }
  if (k === "tool_args") return "{}";
  if (k === "schema_definition") return '{"name":{"type":"string"},"company":{"type":"string"}}';
  if (k === "tools") {
    return '[{"type":"function","function":{"name":"lookup","description":"Lookup a record","parameters":{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}}}]';
  }
  if (k === "collection_name") return "documents";
  if (k === "prompt") return "Summarize the row in one sentence.";
  if (k === "feedback") return "answer_relevance";
  if (k === "dtypes" || k === "casts" || k === "column_types") {
    return '{"amount":"float64","created_at":"datetime64[ns]"}';
  }

  switch (field.type) {
    case "string_list": {
      const k = field.key.toLowerCase();
      if (k.includes("key") || k === "on" || k.includes("business")) return ["id"];
      if (k.includes("column") || k.includes("segment")) return ["col_a", "col_b"];
      if (k.includes("order")) return ["updated_at"];
      return ["id"];
    }
    case "text":
    case "string":
      return sampleString(field.key, field);
    case "number":
      return 1;
    case "boolean":
      return true;
    case "select":
      return field.options?.[0] ?? "left";
    default:
      return "x";
  }
}

/** Minimal valid config for native compile smoke tests. */
export function minimalNativeConfig(def: NativeComponentDefinition): Record<string, unknown> {
  const config: Record<string, unknown> = { template_id: def.id };
  for (const field of def.fields) {
    config[field.key] = sampleValue(field);
  }

  const mockMcpServer = {
    id: "mock-mcp-server",
    name: "mock",
    transport: "http" as const,
    config: { url: "https://example.com/mcp" },
    secretEnvKeys: [],
  };

  if (def.id === "mcp_tool_call") {
    config._resolved_mcp_server = mockMcpServer;
    config.tool_name = config.tool_name ?? "sample_tool";
  }
  if (def.id === "litellm_agent") {
    config._resolved_mcp_servers = [mockMcpServer];
  }
  if (def.id === "router" || def.id === "conditional_split" || def.id === "branch") {
    config.routes =
      '[{"condition":"status = \\"active\\"","output_table":"staging.active_rows"}]';
  }

  return config;
}
