import { describe, expect, it, afterEach } from "vitest";
import {
  duckdbExtensionDirectory,
  isDuckdbModuleMissingError,
  isDuckdbNativeFallbackError,
  isMotherduckOrRemotePath,
  resolveDuckdbHomeDirectory,
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

  it("detects missing home directory errors", () => {
    expect(
      isDuckdbNativeFallbackError(
        "IO Error: Can't find the home directory at '' Specify a home directory using the SET home_directory='/path/to/dir' option."
      )
    ).toBe(true);
  });
});

describe("resolveDuckdbHomeDirectory", () => {
  const originalHome = process.env.HOME;
  const originalDuckdbHome = process.env.DUCKDB_HOME;

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalDuckdbHome === undefined) delete process.env.DUCKDB_HOME;
    else process.env.DUCKDB_HOME = originalDuckdbHome;
  });

  it("falls back to tmp when HOME is empty", () => {
    delete process.env.HOME;
    delete process.env.DUCKDB_HOME;
    expect(resolveDuckdbHomeDirectory()).toBeTruthy();
  });

  it("builds extension directory under home", () => {
    expect(duckdbExtensionDirectory("/tmp")).toBe("/tmp/.duckdb/extensions");
  });
});

describe("isMotherduckOrRemotePath", () => {
  it("treats md: and cloud URIs as remote", () => {
    expect(isMotherduckOrRemotePath("md:my_db?motherduck_token=x")).toBe(true);
    expect(isMotherduckOrRemotePath("s3://bucket/db.duckdb")).toBe(true);
    expect(isMotherduckOrRemotePath("/tmp/local.duckdb")).toBe(false);
  });
});
