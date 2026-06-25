import { describe, expect, it } from "vitest";
import { mergeConnectionRuntimeSecrets, resolveDuckdbDatabaseLocation } from "./duckdb-destination";

describe("resolveDuckdbDatabaseLocation", () => {
  it("prefers legacy env secrets", () => {
    expect(
      resolveDuckdbDatabaseLocation({ DEST_DUCKDB_PATH: "s3://b/w.duckdb" }, { database: "gs://x/y.duckdb" })
    ).toBe("s3://b/w.duckdb");
  });

  it("falls back to connection config.database", () => {
    expect(resolveDuckdbDatabaseLocation({}, { database: "s3://bucket/warehouse.duckdb" })).toBe(
      "s3://bucket/warehouse.duckdb"
    );
  });
});

describe("mergeConnectionRuntimeSecrets", () => {
  it("maps destination config.database to DEST_DUCKDB_PATH", () => {
    expect(
      mergeConnectionRuntimeSecrets("destination", "duckdb", {}, { database: "s3://b/w.duckdb" })
    ).toEqual({ DEST_DUCKDB_PATH: "s3://b/w.duckdb" });
  });

  it("maps motherduck database config to MOTHERDUCK_DATABASE", () => {
    expect(
      mergeConnectionRuntimeSecrets("destination", "motherduck", { MOTHERDUCK_TOKEN: "t" }, { database: "analytics" })
    ).toEqual({ MOTHERDUCK_TOKEN: "t", MOTHERDUCK_DATABASE: "analytics" });
  });
});
