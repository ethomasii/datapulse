import { describe, expect, it } from "vitest";
import {
  buildMotherduckPostgresClientConfig,
  motherduckPostgresHost,
  pgResultToRowset,
} from "./motherduck-pg-client";

describe("buildMotherduckPostgresClientConfig", () => {
  it("targets the MotherDuck Postgres endpoint with token as password", () => {
    const config = buildMotherduckPostgresClientConfig("md_test_token", "my_db");
    expect(config.host).toBe("pg.us-east-1-aws.motherduck.com");
    expect(config.port).toBe(5432);
    expect(config.user).toBe("postgres");
    expect(config.password).toBe("md_test_token");
    expect(config.database).toBe("my_db");
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("prefers MOTHERDUCK_HOST env for region", () => {
    const prev = process.env.MOTHERDUCK_HOST;
    process.env.MOTHERDUCK_HOST = "pg.eu-central-1-aws.motherduck.com";
    try {
      expect(motherduckPostgresHost()).toBe("pg.eu-central-1-aws.motherduck.com");
    } finally {
      if (prev === undefined) delete process.env.MOTHERDUCK_HOST;
      else process.env.MOTHERDUCK_HOST = prev;
    }
  });
});

describe("pgResultToRowset", () => {
  it("maps pg rows to column/row arrays", () => {
    const rowset = pgResultToRowset({
      fields: [{ name: "ok" }, { name: "name" }],
      rows: [{ ok: 1, name: "alpha" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
    });
    expect(rowset).toEqual({
      columns: ["ok", "name"],
      rows: [[1, "alpha"]],
    });
  });
});
