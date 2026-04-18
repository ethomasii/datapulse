import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeControlPlaneBase,
  resolveControlPlaneBaseUrl,
  resolveManagedExecutorMode,
} from "./managed-worker-stub-http";

describe("resolveControlPlaneBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers ELTPULSE_CONTROL_PLANE_URL over CRON_APP_URL", () => {
    vi.stubEnv("ELTPULSE_CONTROL_PLANE_URL", "https://cp.example/");
    vi.stubEnv("ELTPULSE_CRON_APP_URL", "https://custom.example/");
    expect(resolveControlPlaneBaseUrl()).toBe("https://cp.example");
  });

  it("prefers ELTPULSE_CRON_APP_URL when CONTROL_PLANE unset", () => {
    vi.stubEnv("ELTPULSE_CRON_APP_URL", "https://custom.example/");
    vi.stubEnv("VERCEL_URL", "ignored.vercel.app");
    expect(resolveControlPlaneBaseUrl()).toBe("https://custom.example");
  });

  it("uses https://VERCEL_URL when set", () => {
    vi.stubEnv("VERCEL_URL", "my-app.vercel.app");
    expect(resolveControlPlaneBaseUrl()).toBe("https://my-app.vercel.app");
  });

  it("falls back to NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000/");
    expect(resolveControlPlaneBaseUrl()).toBe("http://localhost:3000");
  });
});

describe("normalizeControlPlaneBase", () => {
  it("strips trailing slash", () => {
    expect(normalizeControlPlaneBase("https://x.com/")).toBe("https://x.com");
  });
});

describe("resolveManagedExecutorMode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to stub when no GitHub dispatch env", () => {
    expect(resolveManagedExecutorMode()).toBe("stub");
  });

  it("defaults to gha when dispatch token and repository are set and executor unset", () => {
    vi.stubEnv("ELTPULSE_GITHUB_DISPATCH_TOKEN", "ghp_test");
    vi.stubEnv("ELTPULSE_GITHUB_REPOSITORY", "acme/app");
    expect(resolveManagedExecutorMode()).toBe("gha");
  });

  it("explicit stub overrides GitHub dispatch env", () => {
    vi.stubEnv("ELTPULSE_MANAGED_EXECUTOR", "stub");
    vi.stubEnv("ELTPULSE_GITHUB_DISPATCH_TOKEN", "ghp_test");
    vi.stubEnv("ELTPULSE_GITHUB_REPOSITORY", "acme/app");
    expect(resolveManagedExecutorMode()).toBe("stub");
  });

  it("honors local", () => {
    vi.stubEnv("ELTPULSE_MANAGED_EXECUTOR", "local");
    expect(resolveManagedExecutorMode()).toBe("local");
  });

  it("honors vercel-python", () => {
    vi.stubEnv("ELTPULSE_MANAGED_EXECUTOR", "vercel-python");
    expect(resolveManagedExecutorMode()).toBe("vercel-python");
  });

  it("honors delegate", () => {
    vi.stubEnv("ELTPULSE_MANAGED_EXECUTOR", "delegate");
    expect(resolveManagedExecutorMode()).toBe("delegate");
  });

  it("honors gha", () => {
    vi.stubEnv("ELTPULSE_MANAGED_EXECUTOR", "gha");
    expect(resolveManagedExecutorMode()).toBe("gha");
  });
});
