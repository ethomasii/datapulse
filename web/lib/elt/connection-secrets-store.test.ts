import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "@/lib/crypto/token-encryption";
import {
  allowedSecretKeysForConnection,
  mergeConnectionSecretsEnc,
  parseStoredConnectionSecrets,
} from "./connection-secrets-store";

/** 32 zero bytes as base64 — valid AES-256 key for tests. */
const TEST_ENC_KEY = Buffer.alloc(32, 0).toString("base64");

describe("connection-secrets-store", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allowedSecretKeysForConnection includes postgres source password", () => {
    const keys = allowedSecretKeysForConnection("source", "postgres");
    expect(keys.has("POSTGRES_PASSWORD")).toBe(true);
    expect(keys.has("POSTGRES_HOST")).toBe(true);
  });

  it("parseStoredConnectionSecrets returns {} for null/empty", () => {
    expect(parseStoredConnectionSecrets(null)).toEqual({});
    expect(parseStoredConnectionSecrets("")).toEqual({});
  });

  it("parseStoredConnectionSecrets round-trips encrypted JSON", () => {
    vi.stubEnv("ELTPULSE_TOKEN_ENCRYPTION_KEY", TEST_ENC_KEY);
    const enc = encryptSecret(JSON.stringify({ POSTGRES_PASSWORD: "secret1" }));
    expect(parseStoredConnectionSecrets(enc)).toEqual({ POSTGRES_PASSWORD: "secret1" });
  });

  it("mergeConnectionSecretsEnc(undefined) leaves existing unchanged", () => {
    vi.stubEnv("ELTPULSE_TOKEN_ENCRYPTION_KEY", TEST_ENC_KEY);
    const enc = encryptSecret(JSON.stringify({ POSTGRES_PASSWORD: "a" }));
    expect(mergeConnectionSecretsEnc(enc, undefined, "source", "postgres")).toBe(enc);
  });

  it("mergeConnectionSecretsEnc(null) clears", () => {
    vi.stubEnv("ELTPULSE_TOKEN_ENCRYPTION_KEY", TEST_ENC_KEY);
    const enc = encryptSecret(JSON.stringify({ POSTGRES_PASSWORD: "a" }));
    expect(mergeConnectionSecretsEnc(enc, null, "source", "postgres")).toBeNull();
  });

  it("mergeConnectionSecretsEnc merges allowed keys and ignores unknown keys", () => {
    vi.stubEnv("ELTPULSE_TOKEN_ENCRYPTION_KEY", TEST_ENC_KEY);
    const next = mergeConnectionSecretsEnc(
      null,
      {
        POSTGRES_PASSWORD: "p1",
        STRIPE_API_KEY: "should-drop",
      },
      "source",
      "postgres"
    );
    expect(next).not.toBeNull();
    expect(parseStoredConnectionSecrets(next)).toEqual({ POSTGRES_PASSWORD: "p1" });
  });

  it("mergeConnectionSecretsEnc empty string removes key and null when empty", () => {
    vi.stubEnv("ELTPULSE_TOKEN_ENCRYPTION_KEY", TEST_ENC_KEY);
    const enc = encryptSecret(
      JSON.stringify({ POSTGRES_PASSWORD: "x", POSTGRES_USER: "u" })
    );
    const next = mergeConnectionSecretsEnc(
      enc,
      { POSTGRES_PASSWORD: "" },
      "source",
      "postgres"
    );
    expect(next).not.toBeNull();
    expect(parseStoredConnectionSecrets(next)).toEqual({ POSTGRES_USER: "u" });

    const cleared = mergeConnectionSecretsEnc(
      next,
      { POSTGRES_USER: "" },
      "source",
      "postgres"
    );
    expect(cleared).toBeNull();
  });
});
