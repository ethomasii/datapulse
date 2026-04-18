import { describe, expect, it } from "vitest";
import { parseGithubRepositoryUrl } from "./parse-github-repo-url";

describe("parseGithubRepositoryUrl", () => {
  it("parses https repo URL", () => {
    expect(parseGithubRepositoryUrl("https://github.com/acme/data-pipelines")).toEqual({
      owner: "acme",
      repo: "data-pipelines",
    });
  });

  it("parses .git and tree ref", () => {
    expect(parseGithubRepositoryUrl("https://github.com/acme/data-pipelines.git/tree/develop")).toEqual({
      owner: "acme",
      repo: "data-pipelines",
      branch: "develop",
    });
  });

  it("parses ssh", () => {
    expect(parseGithubRepositoryUrl("git@github.com:acme/data-pipelines.git")).toEqual({
      owner: "acme",
      repo: "data-pipelines",
    });
  });

  it("returns null for non-GitHub", () => {
    expect(parseGithubRepositoryUrl("https://gitlab.com/a/b")).toBeNull();
  });
});
