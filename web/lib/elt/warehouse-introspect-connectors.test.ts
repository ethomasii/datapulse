import { describe, expect, it } from "vitest";
import { motherduckDatabaseName } from "./motherduck-dsn";

describe("motherduckDatabaseName", () => {
  it("prefers config.database over MOTHERDUCK_DATABASE for cross-catalog queries", () => {
    expect(
      motherduckDatabaseName(
        { MOTHERDUCK_DATABASE: "eltpulse", MOTHERDUCK_TOKEN: "t" },
        { database: "my_db" }
      )
    ).toBe("my_db");
  });

  it("falls back to MOTHERDUCK_DATABASE when config has no database", () => {
    expect(motherduckDatabaseName({ MOTHERDUCK_DATABASE: "analytics" }, {})).toBe("analytics");
  });
});
