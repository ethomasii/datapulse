import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/elt/workspace-connection-load", () => ({
  loadWorkspaceConnectionById: vi.fn(),
}));

import { loadWorkspaceConnectionById } from "@/lib/elt/workspace-connection-load";
import { validateManagedPipelineConnections } from "./pipeline-run-readiness";

const mockLoad = vi.mocked(loadWorkspaceConnectionById);

describe("validateManagedPipelineConnections", () => {
  beforeEach(() => {
    mockLoad.mockReset();
  });

  it("requires a source connection for github pipelines", async () => {
    const out = await validateManagedPipelineConnections({
      userId: "user-1",
      sourceType: "github",
      destinationType: "duckdb",
      sourceConnectionId: null,
      destinationConnectionId: "dest-1",
    });
    expect(out).toEqual({
      ok: false,
      error: "Link a github source connection in the builder before running this pipeline.",
    });
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("requires GITHUB_TOKEN on the linked source connection", async () => {
    mockLoad.mockResolvedValueOnce({
      id: "src-1",
      name: "qs-github",
      connectionType: "source",
      connector: "github",
      config: {},
      secrets: {},
    });

    const out = await validateManagedPipelineConnections({
      userId: "user-1",
      sourceType: "github",
      destinationType: "duckdb",
      sourceConnectionId: "src-1",
      destinationConnectionId: null,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toContain("GITHUB_TOKEN");
    }
  });

  it("passes when github source connection has GITHUB_TOKEN", async () => {
    mockLoad.mockResolvedValueOnce({
      id: "src-1",
      name: "qs-github",
      connectionType: "source",
      connector: "github",
      config: {},
      secrets: { GITHUB_TOKEN: "ghp_test" },
    });

    const out = await validateManagedPipelineConnections({
      userId: "user-1",
      sourceType: "github",
      destinationType: "duckdb",
      sourceConnectionId: "src-1",
      destinationConnectionId: null,
    });
    expect(out).toEqual({ ok: true });
  });
});
