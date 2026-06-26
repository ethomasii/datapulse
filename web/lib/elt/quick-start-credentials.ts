import { getDestinationCredentials, getSourceCredentials } from "@/lib/elt/credentials-catalog";
import { quickStartDestinationConfig as destinationConfigForConnector } from "@/lib/elt/starter-warehouse";

export type QuickStartSecretField = {
  key: string;
  label: string;
  help?: string;
  helpUrl?: string;
  placeholder?: string;
};

function catalogSecretFields(
  connectionType: "source" | "destination",
  connector: string
): QuickStartSecretField[] {
  const fields =
    connectionType === "destination"
      ? getDestinationCredentials(connector)
      : getSourceCredentials(connector);
  const secretTypes = new Set(["password", "textarea"]);
  return fields
    .filter((f) => secretTypes.has(f.type))
    .map((f) => ({
      key: f.key,
      label: f.label,
      help: f.help,
      placeholder: f.placeholder,
    }));
}

export function quickStartSecretFields(
  connectionType: "source" | "destination",
  connector: string
): QuickStartSecretField[] {
  const fromCatalog = catalogSecretFields(connectionType, connector);
  if (fromCatalog.length > 0) return fromCatalog;

  const c = connector.toLowerCase();
  if (c === "github") {
    return [
      {
        key: "GITHUB_TOKEN",
        label: "GitHub Personal Access Token",
        help: "Fine-grained (recommended): pick repos + read access to Contents & Issues. Classic: enable repo scope.",
        helpUrl: "https://github.com/settings/personal-access-tokens",
        placeholder: "ghp_…",
      },
    ];
  }
  if (c === "stripe" || c === "stripe_analytics") {
    return [
      {
        key: "STRIPE_SECRET_KEY",
        label: "Stripe secret key",
        help: "Stripe Dashboard → Developers → API keys. Use sk_test_… for sandbox.",
        helpUrl: "https://dashboard.stripe.com/test/apikeys",
        placeholder: "sk_test_…",
      },
    ];
  }
  if (c === "postgres" || c === "postgresql") {
    return [
      {
        key: "DATABASE_URL",
        label: "PostgreSQL connection URL",
        help: "postgresql://user:password@host:5432/dbname — use a read-only user when possible.",
      },
    ];
  }
  if (c === "duckdb") return [];
  return [];
}

export function duckdbDestinationConfig(): Record<string, string> {
  return {};
}

export { destinationConfigForConnector as quickStartDestinationConfig };
