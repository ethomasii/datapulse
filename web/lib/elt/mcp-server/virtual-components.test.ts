import { describe, expect, it } from "vitest";
import {
  encodeMcpVirtualComponentId,
  mcpInputSchemaToFields,
  normalizeMcpVirtualConfig,
  parseMcpVirtualComponentId,
} from "./virtual-components";

describe("mcp virtual components", () => {
  it("round-trips virtual component ids", () => {
    const id = encodeMcpVirtualComponentId("srv-1", "create_refund");
    expect(parseMcpVirtualComponentId(id)).toEqual({ serverId: "srv-1", toolName: "create_refund" });
    const encoded = encodeMcpVirtualComponentId("srv-2", "tool/with/slashes");
    expect(parseMcpVirtualComponentId(encoded)?.toolName).toBe("tool/with/slashes");
  });

  it("maps inputSchema properties to form fields", () => {
    const fields = mcpInputSchemaToFields({
      type: "object",
      required: ["amount"],
      properties: {
        amount: { type: "number", description: "Refund amount in cents" },
        reason: { type: "string" },
      },
    });
    expect(fields).toHaveLength(2);
    expect(fields[0]?.key).toBe("__mcp_arg__amount");
    expect(fields[0]?.required).toBe(true);
    expect(fields[0]?.type).toBe("number");
  });

  it("merges virtual arg fields into tool_args", () => {
    const id = encodeMcpVirtualComponentId("srv-1", "create_refund");
    const normalized = normalizeMcpVirtualConfig({
      template_id: id,
      __mcp_arg__amount: 500,
      __mcp_arg__reason: "duplicate",
    });
    expect(normalized.mcp_server_id).toBe("srv-1");
    expect(normalized.tool_name).toBe("create_refund");
    expect(normalized.tool_args).toEqual({ amount: 500, reason: "duplicate" });
  });
});
