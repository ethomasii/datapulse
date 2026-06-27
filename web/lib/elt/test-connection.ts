import { credentialKeysForConnectionSide } from "@/lib/elt/credential-payload";
import { parseStoredConnectionSecrets } from "@/lib/elt/connection-secrets-store";

export type ConnectionTestInput = {
  connectionType: "source" | "destination";
  connector: string;
  config: Record<string, unknown>;
  connectionSecretsEnc?: string | null;
  /** Inline secrets for test-before-save (quick start). */
  secrets?: Record<string, string>;
};

export type ConnectionTestResult = {
  ok: boolean;
  message: string;
  details?: string;
};

function mergedSecrets(input: ConnectionTestInput): Record<string, string> {
  const fromStore = parseStoredConnectionSecrets(input.connectionSecretsEnc);
  return { ...fromStore, ...(input.secrets ?? {}) };
}

function requireKeys(
  secrets: Record<string, string>,
  connector: string,
  connectionType: "source" | "destination"
): ConnectionTestResult | null {
  const keys = credentialKeysForConnectionSide(connectionType, connector);
  const missing = Array.from(keys).filter((k) => !secrets[k]?.trim());
  if (missing.length === 0) return null;
  return {
    ok: false,
    message: `Missing required secret${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
  };
}

async function testPostgres(secrets: Record<string, string>, config: Record<string, unknown>): Promise<ConnectionTestResult> {
  const conn =
    secrets.DATABASE_URL ??
    secrets.POSTGRES_CONNECTION_STRING ??
    (typeof config.connection_string === "string" ? config.connection_string : "");
  if (!conn?.trim()) {
    return { ok: false, message: "Set DATABASE_URL or connection_string to test PostgreSQL." };
  }
  try {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: conn.trim() });
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    return { ok: true, message: "PostgreSQL connection succeeded." };
  } catch (e) {
    return {
      ok: false,
      message: "Could not connect to PostgreSQL.",
      details: e instanceof Error ? e.message : String(e),
    };
  }
}

async function testGithub(secrets: Record<string, string>): Promise<ConnectionTestResult> {
  const token = secrets.GITHUB_TOKEN ?? secrets.github_token ?? "";
  if (!token.trim()) return { ok: false, message: "Set GITHUB_TOKEN to test GitHub." };
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    return { ok: false, message: `GitHub API returned ${res.status}.`, details: (await res.text()).slice(0, 200) };
  }
  const user = (await res.json()) as { login?: string };
  return { ok: true, message: `GitHub token valid${user.login ? ` (@${user.login})` : ""}.` };
}

async function testHttp(config: Record<string, unknown>): Promise<ConnectionTestResult> {
  const url = typeof config.base_url === "string" ? config.base_url : typeof config.url === "string" ? config.url : "";
  if (!url.trim()) return { ok: false, message: "Set base_url in config to test REST API." };
  try {
    const res = await fetch(url.trim(), { method: "GET", signal: AbortSignal.timeout(12_000) });
    return {
      ok: res.ok || res.status < 500,
      message: res.ok ? `HTTP ${res.status} — endpoint reachable.` : `HTTP ${res.status} — check URL and auth.`,
    };
  } catch (e) {
    return { ok: false, message: "HTTP request failed.", details: e instanceof Error ? e.message : String(e) };
  }
}

export async function testConnection(input: ConnectionTestInput): Promise<ConnectionTestResult> {
  const connector = input.connector.toLowerCase();
  const secrets = mergedSecrets(input);
  const config = input.config ?? {};

  const missing = requireKeys(secrets, connector, input.connectionType);
  if (missing && connector !== "duckdb") {
    if (Object.keys(secrets).length === 0) {
      return {
        ok: false,
        message: "No secrets stored yet — add credentials before testing.",
      };
    }
    return missing;
  }

  if (connector === "postgres" || connector === "postgresql") {
    return testPostgres(secrets, config);
  }
  if (connector === "github") {
    return testGithub(secrets);
  }
  if (connector === "rest_api" || connector === "http") {
    return testHttp(config);
  }
  if (connector === "duckdb") {
    const loc =
      typeof config.database === "string"
        ? config.database.trim()
        : typeof config.path === "string"
          ? config.path.trim()
          : "";
    if (loc) {
      return {
        ok: true,
        message: `DuckDB location set (${loc}). Full connectivity is verified on the first pipeline run.`,
      };
    }
    return {
      ok: true,
      message:
        "DuckDB ready — leave location empty for eltPulse-managed storage, or set s3:// / gs:// on the connection.",
    };
  }
  if (connector === "motherduck") {
    const { motherduckToken, executeMotherduckSql, motherduckDatabaseName } = await import(
      "@/lib/elt/warehouse-introspect-connectors"
    );
    const { listMotherduckDatabases, resolveMotherduckAttachDatabase } = await import(
      "@/lib/elt/motherduck-warehouse"
    );
    const token = motherduckToken(secrets);
    if (!token.trim()) {
      if (input.connectionSecretsEnc?.trim()) {
        return {
          ok: false,
          message:
            "Stored MotherDuck token could not be read — re-enter MOTHERDUCK_TOKEN and save. If this persists, verify ELTPULSE_TOKEN_ENCRYPTION_KEY on the server.",
        };
      }
      return { ok: false, message: "Set MOTHERDUCK_TOKEN to test MotherDuck." };
    }
    const configuredDb = motherduckDatabaseName(secrets, input.config);
    try {
      const attachDb = await resolveMotherduckAttachDatabase(secrets, input.config);
      await executeMotherduckSql(secrets, "SELECT 1 AS ok", attachDb ?? configuredDb);
      const listed = await listMotherduckDatabases(secrets, input.config);
      const catalogList = listed.length ? listed.join(", ") : "(could not list catalogs)";
      if (attachDb && attachDb !== configuredDb) {
        return {
          ok: true,
          message: `MotherDuck connected via "${attachDb}". Update Database from "${configuredDb}" to "${attachDb}". Visible catalogs: ${catalogList}.`,
        };
      }
      if (!attachDb) {
        return {
          ok: true,
          message: `MotherDuck token works (default attach). Visible catalogs: ${catalogList}. Set Database to where dlt loaded data (often "my_db").`,
        };
      }
      return {
        ok: true,
        message: `MotherDuck connected — database "${attachDb}". Visible catalogs: ${catalogList}.`,
      };
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return { ok: false, message: detail.slice(0, 280) };
    }
  }
  if (connector === "stripe" || connector === "stripe_analytics") {
    const key = secrets.STRIPE_SECRET_KEY ?? secrets.stripe_secret_key ?? "";
    if (!key.trim()) return { ok: false, message: "Set STRIPE_SECRET_KEY to test Stripe." };
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${key.trim()}` },
    });
    return res.ok
      ? { ok: true, message: "Stripe API key is valid." }
      : { ok: false, message: `Stripe API returned ${res.status}.` };
  }

  if (Object.keys(secrets).length > 0) {
    return {
      ok: true,
      message: `Required secrets present for ${connector}. Full live test runs on first pipeline sync.`,
    };
  }

  return {
    ok: false,
    message: `No automated test for ${connector} yet — add secrets and run a pipeline to validate.`,
  };
}
