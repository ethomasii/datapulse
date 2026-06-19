import { describe, expect, it, vi, afterEach } from "vitest";
import { isClerkConfigured } from "@/lib/clerk/is-configured";

describe("isClerkConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when key is missing or placeholder", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    expect(isClerkConfigured()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_...");
    expect(isClerkConfigured()).toBe(false);
  });

  it("returns true for real-looking publishable keys", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_abc123");
    expect(isClerkConfigured()).toBe(true);
  });
});
