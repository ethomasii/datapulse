import { describe, expect, it } from "vitest";
import { resolveVerifiedSourceSpec } from "./verified-source-spec";

describe("resolveVerifiedSourceSpec partition defaults", () => {
  it("wires personio via dlt_incremental_env", () => {
    const spec = resolveVerifiedSourceSpec("personio");
    expect(spec?.partitionSliceMode).toBe("dlt_incremental_env");
  });

  it("wires salesforce via dlt_incremental_env", () => {
    const spec = resolveVerifiedSourceSpec("salesforce");
    expect(spec?.partitionSliceMode).toBe("dlt_incremental_env");
  });

  it("wires asana via dlt_incremental_env", () => {
    const spec = resolveVerifiedSourceSpec("asana");
    expect(spec?.partitionSliceMode).toBe("dlt_incremental_env");
  });

  it("wires matomo via dlt_incremental_env", () => {
    const spec = resolveVerifiedSourceSpec("matomo");
    expect(spec?.partitionSliceMode).toBe("dlt_incremental_env");
    expect(spec?.factory).toBe("matomo_visits");
  });

  it("wires facebook ads insights via dlt_incremental_env", () => {
    const spec = resolveVerifiedSourceSpec("facebook_ads");
    expect(spec?.partitionSliceMode).toBe("dlt_incremental_env");
    expect(spec?.factory).toBe("facebook_insights_source");
  });

  it("wires strapi since/until kwargs", () => {
    const spec = resolveVerifiedSourceSpec("strapi");
    expect(spec?.partitionKwarg).toBe("since");
    expect(spec?.partitionEndKwarg).toBe("until");
  });

  it("leaves full-replace sources without partition kwargs", () => {
    const spec = resolveVerifiedSourceSpec("google_sheets");
    expect(spec?.partitionKwarg).toBeUndefined();
    expect(spec?.partitionSliceMode).toBeUndefined();
  });
});
