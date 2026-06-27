/** Starter warehouse onboarding — MotherDuck as default "no warehouse yet" path. */

export const STARTER_WAREHOUSE_DEFAULT_DB = "my_db";

export const MOTHERDUCK_SIGNUP_URL = "https://app.motherduck.com/";

/** End-to-end tutorial (signup, first query, load data). */
export const MOTHERDUCK_GETTING_STARTED_URL =
  "https://motherduck.com/docs/getting-started/e2e-tutorial/";

/** Step-by-step for creating a Read/Write access token in the MotherDuck UI. */
export const MOTHERDUCK_TOKEN_DOCS_URL =
  "https://motherduck.com/docs/key-tasks/authenticating-and-connecting-to-motherduck/authenticating-to-motherduck/";

export const MOTHERDUCK_TOKEN_DOCS =
  "Organization → Settings → Create token (Read/Write). Copy the md_… value once — MotherDuck only shows it once.";

export function motherduckDestinationConfig(database?: string): Record<string, string> {
  const db = (database ?? STARTER_WAREHOUSE_DEFAULT_DB).trim() || STARTER_WAREHOUSE_DEFAULT_DB;
  return { database: db };
}

export function quickStartDestinationConfig(
  connector: string,
  config: Record<string, string>
): Record<string, unknown> {
  if (connector === "motherduck") {
    return motherduckDestinationConfig(config.database);
  }
  if (connector === "duckdb") {
    return {};
  }
  return {};
}
