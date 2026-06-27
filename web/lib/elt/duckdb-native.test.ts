import { describe, expect, it } from "vitest";
import { isDuckdbModuleMissingError } from "./duckdb-native";

describe("isDuckdbModuleMissingError", () => {
  it("detects missing duckdb package errors", () => {
    expect(isDuckdbModuleMissingError("Cannot find package 'duckdb' imported from /var/task/...")).toBe(
      true
    );
    expect(isDuckdbModuleMissingError('Cannot find module "duckdb"')).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isDuckdbModuleMissingError("Catalog Error: Table does not exist")).toBe(false);
  });
});
