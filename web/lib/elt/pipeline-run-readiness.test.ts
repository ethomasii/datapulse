import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/elt/workspace-connection-load", () => ({
  loadWorkspaceConnectionById: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    connection: { findMany: vi.fn() },
    eltPipeline: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/auth/workspace-access", () => ({
  getAccessibleResourceOwnerIds: vi.fn(async () => ["user-1"]),
}));

import { db } from "@/lib/db/client";
import { loadWorkspaceConnectionById } from "@/lib/elt/workspace-connection-load";
import { healPipelineConnectionLinks, validateManagedPipelineConnections } from "./pipeline-run-readiness";

const mockLoad = vi.mocked(loadWorkspaceConnectionById);
const mockFindMany = vi.mocked(db.connection.findMany);
const mockPipelineFind = vi.mocked(db.eltPipeline.findFirst);
const mockPipelineUpdate = vi.mocked(db.eltPipeline.update);

describe("validateManagedPipelineConnections", () => {
  beforeEach(() => {
    mockLoad.mockReset();
    mockFindMany.mockReset();
    mockPipelineFind.mockReset();
    mockPipelineUpdate.mockReset();
    mockFindMany.mockResolvedValue([]);
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

  it("accepts a single saved github connection when the pipeline link was cleared", async () => {
    mockFindMany.mockResolvedValueOnce([{ id: "src-1" }]);
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
      sourceConnectionId: null,
      destinationConnectionId: null,
    });
    expect(out).toEqual({ ok: true });
  });
});

describe("healPipelineConnectionLinks", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockPipelineFind.mockReset();
    mockPipelineUpdate.mockReset();
  });

  it("persists a single matching source connection onto the pipeline", async () => {
    mockPipelineFind.mockResolvedValueOnce({
      id: "pipe-1",
      sourceType: "github",
      destinationType: "motherduck",
      sourceConnectionId: null,
      destinationConnectionId: null,
    } as never);
    mockFindMany
      .mockResolvedValueOnce([{ id: "src-1" }])
      .mockResolvedValueOnce([{ id: "dest-1" }]);

    const out = await healPipelineConnectionLinks("user-1", "pipe-1");
    expect(out).toEqual({ sourceConnectionId: "src-1", destinationConnectionId: "dest-1" });
    expect(mockPipelineUpdate).toHaveBeenCalledWith({
      where: { id: "pipe-1" },
      data: { sourceConnectionId: "src-1", destinationConnectionId: "dest-1" },
    });
  });
});
