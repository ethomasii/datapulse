/**
 * Workspace MCP tools exposed as virtual canvas operators (compile → mcp_tool_call).
 */

import { db } from "@/lib/db/client";
import { canvasPortsForCategory } from "@/lib/elt/component-canvas-io";
import type { ComponentListItem } from "@/lib/elt/component-registry";
import { getNativeComponent } from "@/lib/elt/native-components/registry";
import type { NativeComponentField } from "@/lib/elt/native-components/types";
import { toPublicMcpServer } from "./public";
import type { McpToolDescriptor } from "./types";

export const MCP_VIRTUAL_PREFIX = "mcp_virtual:";

export type ParsedMcpVirtualId = {
  serverId: string;
  toolName: string;
};

export function encodeMcpVirtualComponentId(serverId: string, toolName: string): string {
  return `${MCP_VIRTUAL_PREFIX}${serverId}:${encodeURIComponent(toolName)}`;
}

export function parseMcpVirtualComponentId(id: string): ParsedMcpVirtualId | null {
  const key = id.trim();
  if (!key.startsWith(MCP_VIRTUAL_PREFIX)) return null;
  const rest = key.slice(MCP_VIRTUAL_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep <= 0) return null;
  const serverId = rest.slice(0, sep).trim();
  const toolEnc = rest.slice(sep + 1);
  if (!serverId || !toolEnc) return null;
  try {
    const toolName = decodeURIComponent(toolEnc);
    return toolName ? { serverId, toolName } : null;
  } catch {
    return null;
  }
}

const MCP_ARG_PREFIX = "__mcp_arg__";

function jsonSchemaPropertyType(schema: Record<string, unknown>): NativeComponentField["type"] {
  const type = schema.type;
  if (type === "integer" || type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (Array.isArray(type) && type.includes("string")) return "string";
  if (type === "object" || type === "array") return "text";
  return "string";
}

/** Map MCP tool inputSchema.properties → inspector fields (merged into tool_args at compile). */
export function mcpInputSchemaToFields(inputSchema?: Record<string, unknown>): NativeComponentField[] {
  if (!inputSchema || typeof inputSchema !== "object") return [];
  const props = inputSchema.properties;
  if (!props || typeof props !== "object" || Array.isArray(props)) return [];

  const required = new Set(
    Array.isArray(inputSchema.required) ? inputSchema.required.map(String) : []
  );

  const fields: NativeComponentField[] = [];
  for (const [propName, raw] of Object.entries(props as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const schema = raw as Record<string, unknown>;
    const label =
      typeof schema.title === "string" && schema.title.trim()
        ? schema.title.trim()
        : propName.replace(/_/g, " ");
    fields.push({
      key: `${MCP_ARG_PREFIX}${propName}`,
      label,
      description: typeof schema.description === "string" ? schema.description : undefined,
      type: jsonSchemaPropertyType(schema),
      required: required.has(propName),
      default: schema.default,
      options: Array.isArray(schema.enum) ? schema.enum.map(String) : undefined,
    });
  }
  return fields;
}

export function mcpVirtualFormFields(
  tool: McpToolDescriptor,
  defaults?: { mcpServerId?: string; toolName?: string }
): NativeComponentField[] {
  const argFields = mcpInputSchemaToFields(tool.inputSchema);
  const base: NativeComponentField[] = [
    {
      key: "output_table",
      label: "Output table",
      type: "string",
      required: true,
      default: `staging.mcp_${tool.name.replace(/[^a-zA-Z0-9_]/g, "_")}`,
    },
    {
      key: "parse_as",
      label: "Parse as",
      type: "select",
      options: ["auto", "json", "text"],
      default: "auto",
    },
  ];
  if (argFields.length === 0) {
    base.unshift({
      key: "tool_args",
      label: "Tool args (JSON)",
      type: "text",
      placeholder: "{}",
      default: "{}",
    });
  }
  return [...argFields, ...base];
}

/** Fold __mcp_arg__* keys into tool_args before mcp_tool_call compile. */
export function normalizeMcpVirtualConfig(config: Record<string, unknown>): Record<string, unknown> {
  const templateId = String(config.template_id ?? config.component_id ?? "").trim();
  const parsed = parseMcpVirtualComponentId(templateId);
  const next = { ...config };

  if (parsed) {
    if (!String(next.mcp_server_id ?? "").trim()) next.mcp_server_id = parsed.serverId;
    if (!String(next.tool_name ?? "").trim()) next.tool_name = parsed.toolName;
  }

  let toolArgs: Record<string, unknown> = {};
  const rawArgs = next.tool_args;
  if (typeof rawArgs === "string" && rawArgs.trim()) {
    try {
      toolArgs = JSON.parse(rawArgs) as Record<string, unknown>;
    } catch {
      /* keep empty — compile will warn on invalid JSON */
    }
  } else if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
    toolArgs = { ...(rawArgs as Record<string, unknown>) };
  }

  for (const [key, value] of Object.entries(next)) {
    if (!key.startsWith(MCP_ARG_PREFIX)) continue;
    const prop = key.slice(MCP_ARG_PREFIX.length);
    if (!prop) continue;
    if (value === undefined || value === null || value === "") continue;
    toolArgs[prop] = value;
  }

  if (Object.keys(toolArgs).length) {
    next.tool_args = toolArgs;
  }

  return next;
}

function virtualListItem(
  serverId: string,
  serverName: string,
  tool: McpToolDescriptor
): ComponentListItem {
  const id = encodeMcpVirtualComponentId(serverId, tool.name);
  const safeTable = tool.name.replace(/[^a-zA-Z0-9_]/g, "_");
  return {
    id,
    name: `${serverName} · ${tool.name}`,
    category: "ai",
    description: tool.description?.trim() || `Call ${tool.name} on ${serverName} (deterministic MCP, no LLM).`,
    tags: ["mcp", "tool-call", serverId],
    compileTarget: "python",
    compileBadge: "native",
    compileHint: `MCP tool · ${serverName}`,
    compileTargetLabel: "Python",
    canvasPorts: canvasPortsForCategory("ai"),
    isNative: true,
    hasCompiler: true,
    compilerTier: "native",
    isExecutable: true,
    compilerTierHint: "Deterministic MCP tool call via workspace server.",
    isMcpVirtual: true,
    mcpServerId: serverId,
    mcpServerName: serverName,
    defaultConfig: {
      template_id: id,
      mcp_server_id: serverId,
      tool_name: tool.name,
      output_table: `staging.mcp_${safeTable}`,
      parse_as: "auto",
    },
  };
}

/** Sync catalog stub when DB is unavailable (canvas graph edits, compile). */
export function mcpVirtualListItemStub(parsed: ParsedMcpVirtualId): ComponentListItem {
  const id = encodeMcpVirtualComponentId(parsed.serverId, parsed.toolName);
  const safeTable = parsed.toolName.replace(/[^a-zA-Z0-9_]/g, "_");
  return {
    id,
    name: `MCP · ${parsed.toolName}`,
    category: "ai",
    description: `Deterministic MCP tool call (${parsed.toolName}).`,
    compileTarget: "python",
    compileBadge: "native",
    compileHint: "MCP tool call",
    compileTargetLabel: "Python",
    canvasPorts: canvasPortsForCategory("ai"),
    isNative: true,
    hasCompiler: true,
    compilerTier: "native",
    isExecutable: true,
    compilerTierHint: "Deterministic MCP tool call via workspace server.",
    isMcpVirtual: true,
    mcpServerId: parsed.serverId,
    defaultConfig: {
      template_id: id,
      mcp_server_id: parsed.serverId,
      tool_name: parsed.toolName,
      output_table: `staging.mcp_${safeTable}`,
      parse_as: "auto",
    },
  };
}

export function initialConfigForComponent(component: {
  id: string;
  defaultConfig?: Record<string, unknown>;
}): Record<string, unknown> {
  if (component.defaultConfig && Object.keys(component.defaultConfig).length) {
    return { ...component.defaultConfig, template_id: component.id };
  }
  const parsed = parseMcpVirtualComponentId(component.id);
  if (parsed) {
    const stub = mcpVirtualListItemStub(parsed);
    return { ...(stub.defaultConfig ?? {}), template_id: component.id };
  }
  const native = getNativeComponent(component.id);
  if (native?.fields?.length) {
    const fromFields: Record<string, unknown> = {};
    for (const field of native.fields) {
      if (field.default !== undefined) fromFields[field.key] = field.default;
    }
    if (Object.keys(fromFields).length) {
      return { ...fromFields, template_id: component.id };
    }
  }
  return { template_id: component.id };
}

export async function listMcpVirtualComponents(ownerIds: string[]): Promise<ComponentListItem[]> {
  if (!ownerIds.length) return [];
  try {
    const rows = await db.mcpServer.findMany({
      where: { userId: { in: ownerIds } },
      orderBy: [{ name: "asc" }, { updatedAt: "desc" }],
    });
    const items: ComponentListItem[] = [];
    for (const row of rows) {
      const pub = toPublicMcpServer(row);
      const tools = pub.toolsCache ?? [];
      for (const tool of tools) {
        if (!tool.name?.trim()) continue;
        items.push(virtualListItem(pub.id, pub.name, tool));
      }
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("McpServer") && (msg.includes("does not exist") || msg.includes("P2021"))) {
      return [];
    }
    throw err;
  }
}

export async function getMcpVirtualComponentDetail(
  id: string,
  ownerIds: string[]
): Promise<{ component: ComponentListItem; formFields: NativeComponentField[] } | null> {
  const parsed = parseMcpVirtualComponentId(id);
  if (!parsed || !ownerIds.length) return null;

  try {
    const row = await db.mcpServer.findFirst({
      where: { id: parsed.serverId, userId: { in: ownerIds } },
    });
    if (!row) return null;

    const pub = toPublicMcpServer(row);
    const tool = (pub.toolsCache ?? []).find((t) => t.name === parsed.toolName);
    if (!tool) return null;

    return {
      component: virtualListItem(pub.id, pub.name, tool),
      formFields: mcpVirtualFormFields(tool, {
        mcpServerId: parsed.serverId,
        toolName: parsed.toolName,
      }),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("McpServer") && (msg.includes("does not exist") || msg.includes("P2021"))) {
      return null;
    }
    throw err;
  }
}
