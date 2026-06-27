import { describe, expect, it } from "vitest";
import {
  mcpRowsetFromStructured,
  parseMotherduckMcpResponse,
} from "./motherduck-mcp-client";

describe("parseMotherduckMcpResponse", () => {
  it("maps MCP structuredContent to rowset", () => {
    const rowset = parseMotherduckMcpResponse({
      jsonrpc: "2.0",
      id: 1,
      result: {
        structuredContent: {
          success: true,
          columns: ["ok"],
          columnTypes: ["INTEGER"],
          rows: [[1]],
          rowCount: 1,
        },
        isError: false,
      },
    });
    expect(rowset.columns).toEqual(["ok"]);
    expect(rowset.rows).toEqual([[1]]);
  });

  it("throws on MCP tool error", () => {
    expect(() =>
      parseMotherduckMcpResponse({
        jsonrpc: "2.0",
        id: 1,
        error: { message: "Invalid token" },
      })
    ).toThrow("Invalid token");
  });
});

describe("mcpRowsetFromStructured", () => {
  it("defaults empty columns when missing", () => {
    expect(mcpRowsetFromStructured({ rows: [] })).toEqual({ columns: [], rows: [] });
  });
});
