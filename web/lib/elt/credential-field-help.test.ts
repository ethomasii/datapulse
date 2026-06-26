import { describe, expect, it } from "vitest";
import { parseCredentialHelp } from "./credential-field-help";

describe("parseCredentialHelp", () => {
  it("uses explicit helpUrl", () => {
    expect(parseCredentialHelp("Some steps", "https://example.com/tokens")).toEqual({
      text: "Some steps",
      url: "https://example.com/tokens",
    });
  });

  it("extracts URL from inline help", () => {
    expect(parseCredentialHelp("Create at https://github.com/settings/tokens")).toEqual({
      url: "https://github.com/settings/tokens",
    });
  });

  it("returns plain text when no URL", () => {
    expect(parseCredentialHelp("Dashboard → Developers → API keys")).toEqual({
      text: "Dashboard → Developers → API keys",
    });
  });
});
