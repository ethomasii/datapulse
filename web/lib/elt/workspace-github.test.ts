import { describe, expect, it } from "vitest";
import {
  resolveDefinitionSourceForEnvironment,
  resolveGitBranchForRunEnvironment,
  resolveUserDevelopmentBranch,
} from "@/lib/elt/workspace-github";
import type { WorkspaceGithubSettings } from "@/lib/elt/workspace-github";

function settings(overrides: Partial<WorkspaceGithubSettings> = {}): WorkspaceGithubSettings {
  return {
    connectionUserId: "owner",
    actingUserId: "alice",
    connection: {
      githubLogin: "org",
      defaultRepoOwner: "acme",
      defaultRepoName: "pipelines",
      defaultBranch: "main",
      developmentBranch: "develop",
      productionDefinitionSource: "neon",
      developmentDefinitionSource: "neon",
    },
    repo: {
      owner: "acme",
      name: "pipelines",
      productionBranch: "main",
      developmentBranch: "develop",
    },
    token: "tok",
    personalDevBranch: null,
    productionDefinitionSource: "neon",
    developmentDefinitionSource: "neon",
    ...overrides,
  };
}

describe("workspace-github", () => {
  it("uses personal dev branch when set", () => {
    const s = settings({ personalDevBranch: "dev/alice" });
    expect(resolveUserDevelopmentBranch(s)).toBe("dev/alice");
  });

  it("falls back to shared develop branch", () => {
    expect(resolveUserDevelopmentBranch(settings())).toBe("develop");
  });

  it("maps production runs to main branch", () => {
    expect(resolveGitBranchForRunEnvironment(settings(), "production")).toBe("main");
  });

  it("maps dev runs to personal branch", () => {
    const s = settings({ personalDevBranch: "feat/bob" });
    expect(resolveGitBranchForRunEnvironment(s, "development")).toBe("feat/bob");
  });

  it("picks definition source per environment", () => {
    const s = settings({
      productionDefinitionSource: "git",
      developmentDefinitionSource: "neon",
    });
    expect(resolveDefinitionSourceForEnvironment(s, "production")).toBe("git");
    expect(resolveDefinitionSourceForEnvironment(s, "development")).toBe("neon");
  });
});
