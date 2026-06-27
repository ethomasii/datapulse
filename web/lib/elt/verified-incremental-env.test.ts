import { execSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  VERIFIED_INCREMENTAL_ENV,
  getIncrementalEnvConfig,
  resolveIncrementalEnvSlug,
  slugsWithIncrementalEnv,
} from "./verified-incremental-env";
import { isVendoredVerifiedSource } from "./vendored-verified-sources";

const SCAN_SCRIPT = join(
  __dirname,
  "../../managed-worker-service/scripts/scan-incremental-env.py"
);

describe("VERIFIED_INCREMENTAL_ENV", () => {
  it("vendored incremental scan stays in sync with the TS registry", () => {
    const out = execSync(`python "${SCAN_SCRIPT}"`, { encoding: "utf8" });
    expect(out).toContain("scan OK");
    for (const slug of slugsWithIncrementalEnv()) {
      expect(out, slug).toContain(slug.replace("_dlt", "_dlt"));
    }
  });

  it("covers every env-backed slug detected by the vendored scan", () => {
    const scannedSlugs = ["personio", "salesforce", "asana_dlt", "matomo", "facebook_ads"];
    for (const slug of scannedSlugs) {
      expect(slugsWithIncrementalEnv(), slug).toContain(slug);
      expect(getIncrementalEnvConfig(slug), slug).not.toBeNull();
    }
  });

  it("resolves catalog aliases to env config keys", () => {
    expect(resolveIncrementalEnvSlug("asana")).toBe("asana_dlt");
    expect(getIncrementalEnvConfig("asana")?.resources[0]?.name).toBe("tasks");
  });

  it("maps salesforce merge resources to correct dlt cursor fields", () => {
    const cfg = VERIFIED_INCREMENTAL_ENV.salesforce;
    expect(cfg.dltSourceName).toBe("salesforce");
    const account = cfg.resources.find((r) => r.name === "account");
    const opportunity = cfg.resources.find((r) => r.name === "opportunity");
    expect(account?.cursorField).toBe("LastModifiedDate");
    expect(opportunity?.cursorField).toBe("SystemModstamp");
  });

  it("wires facebook insights via date_start env bounds", () => {
    expect(VERIFIED_INCREMENTAL_ENV.facebook_ads).toEqual({
      dltSourceName: "facebook_ads",
      resources: [{ name: "facebook_insights", cursorField: "date_start" }],
    });
  });

  it("registers env-backed slugs that are vendored on the managed worker", () => {
    for (const slug of Object.keys(VERIFIED_INCREMENTAL_ENV)) {
      expect(isVendoredVerifiedSource(slug), slug).toBe(true);
    }
  });

  it("uses matomo_visits source name for live visits incremental", () => {
    expect(VERIFIED_INCREMENTAL_ENV.matomo).toEqual({
      dltSourceName: "matomo_visits",
      resources: [{ name: "visits", cursorField: "serverTimestamp" }],
    });
  });
});
