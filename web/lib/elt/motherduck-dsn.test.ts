import { describe, expect, it } from "vitest";
import { buildMotherduckDsn, motherduckDatabaseName } from "./motherduck-dsn";

describe("buildMotherduckDsn", () => {
  it("builds md: DSN with saas_mode and token", () => {
    const dsn = buildMotherduckDsn(
      { MOTHERDUCK_TOKEN: "md_test_token" },
      { database: "my_db" }
    );
    expect(dsn.startsWith("md:my_db?")).toBe(true);
    expect(dsn).toContain("motherduck_token=md_test_token");
    expect(dsn).toContain("saas_mode=true");
  });

  it("prefers config.database over MOTHERDUCK_DATABASE secret", () => {
    expect(
      motherduckDatabaseName({ MOTHERDUCK_DATABASE: "eltpulse" }, { database: "my_db" })
    ).toBe("my_db");
  });
});
