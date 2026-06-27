import { describe, expect, it } from "vitest";
import { resolveVerifiedSourceSpec } from "./verified-source-spec";

describe("resolveVerifiedSourceSpec partition defaults", () => {
  it("wires personio via dlt_incremental_env", () => {
    const spec = resolveVerifiedSourceSpec("personio");
    expect(spec?.partitionSliceMode).toBe("dlt_incremental_env");
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
