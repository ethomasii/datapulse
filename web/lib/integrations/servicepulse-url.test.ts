import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDatapulseAppPublicUrl,
  getServicePulseBaseUrl,
  servicePulseDatapulseHandoffUrl,
} from "./servicepulse-url";

describe("servicepulse-url", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults ServicePulse base when env unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SERVICEPULSE_URL", "");
    expect(getServicePulseBaseUrl()).toBe("https://servicepulse.dev");
  });

  it("respects NEXT_PUBLIC_SERVICEPULSE_URL and strips trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SERVICEPULSE_URL", "https://staging.servicepulse.test/");
    expect(getServicePulseBaseUrl()).toBe("https://staging.servicepulse.test");
  });

  it("builds handoff URL with datapulse origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SERVICEPULSE_URL", "https://servicepulse.dev");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.datapulse.test");
    expect(servicePulseDatapulseHandoffUrl()).toBe(
      "https://servicepulse.dev/integrations/datapulse?datapulse_origin=https%3A%2F%2Fapp.datapulse.test"
    );
  });

  it("getDatapulseAppPublicUrl strips trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000/");
    expect(getDatapulseAppPublicUrl()).toBe("http://localhost:3000");
  });
});
