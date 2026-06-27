import { describe, expect, it } from "vitest";
import { diffYamlLines, hashDeclarativeYaml } from "@/lib/elt/pipeline-git-sync";
import { normalizeDeploymentSlug } from "@/lib/elt/deployments";

describe("pipeline-git-sync", () => {
  it("hashDeclarativeYaml is stable for normalized newlines", () => {
    const a = hashDeclarativeYaml("foo: 1\nbar: 2\n");
    const b = hashDeclarativeYaml("foo: 1\r\nbar: 2");
    expect(a).toBe(b);
  });

  it("diffYamlLines marks added and removed lines", () => {
    const diff = diffYamlLines("a\nb\n", "a\nc\n");
    expect(diff.some((l) => l.type === "remove" && l.text === "b")).toBe(true);
    expect(diff.some((l) => l.type === "add" && l.text === "c")).toBe(true);
  });
});

describe("deployments", () => {
  it("normalizeDeploymentSlug sanitizes labels", () => {
    expect(normalizeDeploymentSlug("Production")).toBe("production");
    expect(normalizeDeploymentSlug("  staging env ")).toBe("staging-env");
  });
});
