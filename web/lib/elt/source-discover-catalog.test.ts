import { describe, expect, it } from "vitest";
import {
  applyDiscoveryToSourceConfiguration,
  applyGithubRepoToSourceConfiguration,
} from "./source-discover-catalog";

describe("applyGithubRepoToSourceConfiguration", () => {
  it("sets repos, repo_owner, and repo_name", () => {
    const out = applyGithubRepoToSourceConfiguration({}, "acme/widgets");
    expect(out).toEqual({
      repos: "acme/widgets",
      repo_owner: "acme",
      repo_name: "widgets",
    });
  });
});

describe("applyDiscoveryToSourceConfiguration github", () => {
  it("preserves repo fields while setting resources", () => {
    const base = applyGithubRepoToSourceConfiguration({}, "acme/widgets");
    const out = applyDiscoveryToSourceConfiguration("github", base, ["issues"]);
    expect(out.repo_owner).toBe("acme");
    expect(out.repo_name).toBe("widgets");
    expect(out.resources).toEqual(["issues"]);
  });
});
