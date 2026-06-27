import { describe, expect, it } from "vitest";
import { applyDltDestinationEnvMapping } from "./dlt-connection-env";

describe("applyDltDestinationEnvMapping", () => {
  it("maps postgres config.database to legacy and dlt env keys", () => {
    expect(
      applyDltDestinationEnvMapping(
        "postgres",
        { POSTGRES_PASSWORD: "secret" },
        { host: "db.example.com", port: "5432", database: "analytics", username: "loader" }
      )
    ).toMatchObject({
      POSTGRES_HOST: "db.example.com",
      DEST_POSTGRES_HOST: "db.example.com",
      DESTINATION__POSTGRES__CREDENTIALS__HOST: "db.example.com",
      POSTGRES_DATABASE: "analytics",
      DEST_POSTGRES_DATABASE: "analytics",
      DESTINATION__POSTGRES__CREDENTIALS__DATABASE: "analytics",
      DESTINATION__POSTGRES__CREDENTIALS__USERNAME: "loader",
      POSTGRES_PASSWORD: "secret",
      DESTINATION__POSTGRES__CREDENTIALS__PASSWORD: "secret",
    });
  });

  it("maps snowflake config into SNOWFLAKE_* and dlt keys", () => {
    expect(
      applyDltDestinationEnvMapping(
        "snowflake",
        { SNOWFLAKE_PASSWORD: "pw" },
        { account: "xy.us-east-1", database: "RAW", warehouse: "WH", role: "ANALYST", username: "svc" }
      )
    ).toMatchObject({
      SNOWFLAKE_ACCOUNT: "xy.us-east-1",
      DESTINATION__SNOWFLAKE__CREDENTIALS__HOST: "xy.us-east-1",
      SNOWFLAKE_DATABASE: "RAW",
      DESTINATION__SNOWFLAKE__CREDENTIALS__DATABASE: "RAW",
      DESTINATION__SNOWFLAKE__CREDENTIALS__WAREHOUSE: "WH",
      DESTINATION__SNOWFLAKE__CREDENTIALS__ROLE: "ANALYST",
      SNOWFLAKE_USER: "svc",
      DESTINATION__SNOWFLAKE__CREDENTIALS__PASSWORD: "pw",
    });
  });

  it("maps motherduck database default and token to dlt password", () => {
    expect(applyDltDestinationEnvMapping("motherduck", { MOTHERDUCK_TOKEN: "md_tok" }, {})).toEqual({
      MOTHERDUCK_TOKEN: "md_tok",
      MOTHERDUCK_DATABASE: "my_db",
      DESTINATION__MOTHERDUCK__CREDENTIALS__DATABASE: "my_db",
      DESTINATION__MOTHERDUCK__CREDENTIALS__PASSWORD: "md_tok",
    });
  });

  it("promotes legacy postgres database secret into dlt env", () => {
    expect(
      applyDltDestinationEnvMapping("postgres", { POSTGRES_DATABASE: "warehouse" }, {})
    ).toMatchObject({
      POSTGRES_DATABASE: "warehouse",
      DEST_POSTGRES_DATABASE: "warehouse",
      DESTINATION__POSTGRES__CREDENTIALS__DATABASE: "warehouse",
    });
  });

  it("syncs bigquery project config and credentials blob", () => {
    expect(
      applyDltDestinationEnvMapping(
        "bigquery",
        { GCP_CREDENTIALS: '{"type":"service_account"}' },
        { project: "my-gcp-project" }
      )
    ).toMatchObject({
      GCP_PROJECT_ID: "my-gcp-project",
      DESTINATION__BIGQUERY__CREDENTIALS__PROJECT_ID: "my-gcp-project",
      GCP_CREDENTIALS: '{"type":"service_account"}',
      DESTINATION__BIGQUERY__CREDENTIALS: '{"type":"service_account"}',
    });
  });

  it("maps redshift config.database for dlt runs", () => {
    expect(
      applyDltDestinationEnvMapping(
        "redshift",
        { REDSHIFT_PASSWORD: "pw", REDSHIFT_USER: "u", REDSHIFT_HOST: "h" },
        { database: "prod" }
      )
    ).toMatchObject({
      REDSHIFT_DATABASE: "prod",
      DESTINATION__REDSHIFT__CREDENTIALS__DATABASE: "prod",
    });
  });
});
