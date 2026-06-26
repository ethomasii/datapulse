import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveManagedRunSourceConnection } from "./managed-run-source-secrets";

vi.mock("@/lib/integrations/github-access-token", () => ({
  getGithubAccessTokenForUser: vi.fn(),
}));

import { getGithubAccessTokenForUser } from "@/lib/integrations/github-access-token";

const mockOAuth = vi.mocked(getGithubAccessTokenForUser);

describe("resolveManagedRunSourceConnection", () => {
  beforeEach(() => {
    mockOAuth.mockReset();
  });

  it("returns null when github pipeline has no connection and no oauth", async () => {
    mockOAuth.mockResolvedValue(null);
    const out = await resolveManagedRunSourceConnection("user-1", "github", null);
    expect(out).toBeNull();
  });

  it("synthesizes source from oauth when pipeline is github without sourceConnectionId", async () => {
    mockOAuth.mockResolvedValue("gho_test_token");
    const out = await resolveManagedRunSourceConnection("user-1", "github", null);
    expect(out).toMatchObject({
      connector: "github",
      secrets: { GITHUB_TOKEN: "gho_test_token" },
    });
  });

  it("fills GITHUB_TOKEN from oauth when connection secrets are empty", async () => {
    mockOAuth.mockResolvedValue("gho_oauth");
    const out = await resolveManagedRunSourceConnection("user-1", "github", {
      id: "conn-1",
      name: "github-prod",
      connectionType: "source",
      connector: "github",
      config: {},
      secrets: {},
    });
    expect(out?.secrets.GITHUB_TOKEN).toBe("gho_oauth");
  });

  it("keeps saved PAT when present", async () => {
    mockOAuth.mockResolvedValue("gho_oauth");
    const out = await resolveManagedRunSourceConnection("user-1", "github", {
      id: "conn-1",
      name: "github-prod",
      connectionType: "source",
      connector: "github",
      config: {},
      secrets: { GITHUB_TOKEN: "ghp_saved" },
    });
    expect(out?.secrets.GITHUB_TOKEN).toBe("ghp_saved");
    expect(mockOAuth).not.toHaveBeenCalled();
  });

  it("passes through non-github sources unchanged", async () => {
    const source = {
      id: "conn-2",
      name: "stripe",
      connectionType: "source",
      connector: "stripe",
      config: {},
      secrets: { STRIPE_SECRET_KEY: "sk_test" },
    };
    const out = await resolveManagedRunSourceConnection("user-1", "stripe", source);
    expect(out).toBe(source);
    expect(mockOAuth).not.toHaveBeenCalled();
  });
});
