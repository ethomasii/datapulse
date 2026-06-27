import { describe, expect, it } from "vitest";
import {
  motherduckDatabaseCandidates,
  motherduckDatabaseMismatchHint,
} from "./motherduck-warehouse";

describe("motherduckDatabaseCandidates", () => {
  it("tries my_db before configured eltpulse", () => {
    const dbs = motherduckDatabaseCandidates({ MOTHERDUCK_TOKEN: "t" }, { database: "eltpulse" });
    expect(dbs).toContain("eltpulse");
    expect(dbs).toContain("my_db");
    expect(dbs.indexOf("my_db")).toBeLessThan(dbs.indexOf("eltpulse"));
  });

  it("prefers catalog from 3-part table ref", () => {
    const dbs = motherduckDatabaseCandidates({ MOTHERDUCK_TOKEN: "t" }, { database: "eltpulse" }, "my_db");
    expect(dbs[0]).toBe("my_db");
  });
});

describe("motherduckDatabaseMismatchHint", () => {
  it("suggests updating connection when resolved db differs", () => {
    const hint = motherduckDatabaseMismatchHint("eltpulse", "my_db");
    expect(hint).toContain("my_db");
    expect(hint).toContain("eltpulse");
  });

  it("returns undefined when databases match", () => {
    expect(motherduckDatabaseMismatchHint("my_db", "my_db")).toBeUndefined();
  });
});
