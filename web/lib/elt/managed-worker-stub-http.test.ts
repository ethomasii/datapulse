import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveControlPlaneBaseUrl } from "./managed-worker-stub-http";

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
