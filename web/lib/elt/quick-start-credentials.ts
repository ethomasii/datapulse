import { credentialKeysForConnectionSide } from "@/lib/elt/credential-payload";

export type QuickStartSecretField = { key: string; label: string; placeholder?: string };

export function quickStartSecretFields(
  connectionType: "source" | "destination",
  connector: string
): QuickStartSecretField[] {
  const keys = Array.from(credentialKeysForConnectionSide(connectionType, connector));
  if (keys.length > 0) {
    return keys.map((key) => ({
      key,
      label: key.replace(/_/g, " "),
      placeholder: key.includes("TOKEN") || key.includes("KEY") ? "••••••••" : "",
    }));
  }
  const c = connector.toLowerCase();
  if (c === "github") return [{ key: "GITHUB_TOKEN", label: "GitHub token" }];
  if (c === "stripe" || c === "stripe_analytics") return [{ key: "STRIPE_SECRET_KEY", label: "Stripe secret key" }];
  if (c === "postgres" || c === "postgresql") {
    return [{ key: "DATABASE_URL", label: "PostgreSQL connection URL" }];
  }
  if (c === "duckdb") return [];
  return [];
}

export function duckdbDestinationConfig(): Record<string, string> {
  return {};
}
