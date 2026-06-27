import { describe, expect, it } from "vitest";
import {
  isDuckdbModuleMissingError,
  isDuckdbNativeFallbackError,
  isMotherduckOrRemotePath,
} from "./duckdb-native";

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

describe("isDuckdbNativeFallbackError", () => {
  it("detects connection lifecycle errors", () => {
    expect(
      isDuckdbNativeFallbackError(
        "Connection Error: Connection was never established or has been closed already"
      )
    ).toBe(true);
  });

  it("includes missing module errors", () => {
    expect(isDuckdbNativeFallbackError("Cannot find package 'duckdb'")).toBe(true);
  });
});

describe("isMotherduckOrRemotePath", () => {
  it("treats md: and cloud URIs as remote", () => {
    expect(isMotherduckOrRemotePath("md:my_db?motherduck_token=x")).toBe(true);
    expect(isMotherduckOrRemotePath("s3://bucket/db.duckdb")).toBe(true);
    expect(isMotherduckOrRemotePath("/tmp/local.duckdb")).toBe(false);
  });
});
