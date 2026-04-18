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

  it("prefers ELTPULSE_CRON_APP_URL", () => {
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

  it("defaults to stub", () => {
    expect(resolveManagedExecutorMode()).toBe("stub");
  });

  it("honors local", () => {
    vi.stubEnv("ELTPULSE_MANAGED_EXECUTOR", "local");
    expect(resolveManagedExecutorMode()).toBe("local");
  });
});
