import { describe, expect, it } from "vitest";
import {
  connectionConfigToFormValues,
  formValuesToConnectionConfig,
} from "./credential-payload";

describe("motherduck connection config mapping", () => {
  it("maps config.database to MOTHERDUCK_DATABASE in form values", () => {
    expect(connectionConfigToFormValues("motherduck", { database: "my_db" })).toEqual({
      MOTHERDUCK_DATABASE: "my_db",
    });
  });

  it("maps MOTHERDUCK_DATABASE form value to config.database on save", () => {
    expect(formValuesToConnectionConfig("motherduck", { MOTHERDUCK_DATABASE: "my_db" })).toEqual({
      database: "my_db",
    });
  });
});
