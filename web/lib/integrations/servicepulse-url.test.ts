import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getEltpulseAppPublicUrl,
  getServicePulseBaseUrl,
  servicePulseEltpulseHandoffUrl,
} from "./servicepulse-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("servicepulse-url", () => {
  it("builds handoff URL with eltpulse origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SERVICEPULSE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.eltpulse.test");
    expect(servicePulseEltpulseHandoffUrl()).toBe(
      "https://servicepulse.dev/integrations/eltpulse?eltpulse_origin=https%3A%2F%2Fapp.eltpulse.test"
    );
  });

  it("getEltpulseAppPublicUrl strips trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000/");
    expect(getEltpulseAppPublicUrl()).toBe("http://localhost:3000");
  });

  it("getServicePulseBaseUrl uses default when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SERVICEPULSE_URL", "");
    expect(getServicePulseBaseUrl()).toBe("https://servicepulse.dev");
  });
});
