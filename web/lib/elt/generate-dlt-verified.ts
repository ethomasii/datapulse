import type { PipelineRequest } from "./types";
import { escapePyString } from "./escape-py";
import { dltDbtRunnerBeforeReturn } from "./generate-dlt-dbt-append";
import { eltpulseReportLoadInfoPython } from "./generate-eltpulse-run-reporting";
import { postTransformBeforeReturn } from "./generate-post-transform";
import { eltpulsePythonModuleHeader } from "./codegen-branding";
import {
  resolveVerifiedSourceSpec,
  type VerifiedCredentialSpec,
  type VerifiedSourceSpec,
} from "./verified-source-spec";

function destinationBlock(request: PipelineRequest) {
  let destination: string;
  let destinationComment: string;
  if (request.destinationInstance) {
    destination = `${request.destinationType}__${request.destinationInstance}`;
    destinationComment = `# Named destination: ${destination}`;
  } else {
    destination = request.destinationType;
    destinationComment = "";
  }
  const datasetName =
    request.schemaOverride || `${request.sourceType}_data`.replace(/[^a-zA-Z0-9_]/g, "_");
  return { destination, destinationComment, datasetName };
}

function pyResolveCredential(c: VerifiedCredentialSpec, varName: string): string {
  const keys = c.envKeys.map((k) => `"${escapePyString(k)}"`).join(", ");
  return `${varName} = next((os.environ.get(k) for k in [${keys}] if os.environ.get(k)), None)`;
}

function shopUrlFromConfig(config: Record<string, unknown>): string | null {
  const store = typeof config.store_url === "string" ? config.store_url.trim() : "";
  if (store) return store;
  const shop = typeof config.shop === "string" ? config.shop.trim() : "";
  if (!shop) return null;
  if (shop.startsWith("http://") || shop.startsWith("https://")) return shop;
  if (shop.includes(".myshopify.com")) return `https://${shop.replace(/^https?:\/\//, "")}`;
  return `https://${shop}.myshopify.com`;
}

function parseCommaSeparatedConfig(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((x) => x.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function readResourcesForSpec(
  spec: VerifiedSourceSpec,
  config: Record<string, unknown>
): string[] {
  const keys = [
    ...(spec.resourceConfigKey ? [spec.resourceConfigKey] : []),
    ...(spec.alternateResourceConfigKeys ?? []),
  ];
  let raw: unknown;
  for (const key of keys) {
    if (config[key] !== undefined && config[key] !== null && config[key] !== "") {
      raw = config[key];
      break;
    }
  }
  if (raw === undefined) raw = spec.defaultResources ?? [];
  return spec.normalizeResources ? spec.normalizeResources(raw) : Array.isArray(raw) ? raw.map(String) : [];
}

function buildCredentialSection(spec: VerifiedSourceSpec, config: Record<string, unknown>): {
  imports: string;
  setup: string;
  kwargLines: string[];
} {
  const style = spec.credentialStyle ?? "flat";
  const kwargLines: string[] = [];

  if (style === "zendesk_token") {
    const [sub, email, token] = spec.credentials;
    return {
      imports: "from zendesk.helpers.credentials import ZendeskCredentialsToken",
      setup: `${pyResolveCredential(sub, "_zd_sub")}
${pyResolveCredential(email, "_zd_email")}
${pyResolveCredential(token, "_zd_token")}
    if not _zd_sub or not _zd_email or not _zd_token:
        raise RuntimeError("Set ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, and ZENDESK_API_TOKEN")
    credentials = ZendeskCredentialsToken(subdomain=_zd_sub, email=_zd_email, token=_zd_token)`,
      kwargLines: ["        credentials=credentials,"],
    };
  }

  if (style === "salesforce_security_token") {
    const [user, pass, sec] = spec.credentials;
    return {
      imports: "from salesforce.helpers.client import SecurityTokenAuth",
      setup: `${pyResolveCredential(user, "_sf_user")}
${pyResolveCredential(pass, "_sf_pass")}
${pyResolveCredential(sec, "_sf_token")}
    if not _sf_user or not _sf_pass or not _sf_token:
        raise RuntimeError("Set SALESFORCE_USER, SALESFORCE_PASSWORD, and SALESFORCE_SECURITY_TOKEN")
    credentials = SecurityTokenAuth(user_name=_sf_user, password=_sf_pass, security_token=_sf_token)`,
      kwargLines: ["        credentials=credentials,"],
    };
  }

  if (style === "shopify") {
    const tokenSpec = spec.credentials[0];
    const configuredUrl = shopUrlFromConfig(config);
    const urlLiteral = configuredUrl ? `"${escapePyString(configuredUrl)}"` : "None";
    return {
      imports: "",
      setup: `${pyResolveCredential(tokenSpec, "_shopify_token")}
    if not _shopify_token:
        raise RuntimeError("Set SHOPIFY_ACCESS_TOKEN for Shopify API access")
    store_url = os.environ.get("SHOPIFY_STORE_URL") or ${urlLiteral}
    if not store_url:
        shop_name = (os.environ.get("SHOPIFY_SHOP_NAME") or "").strip().removesuffix(".myshopify.com")
        if shop_name:
            store_url = f"https://{shop_name}.myshopify.com"
    if not store_url:
        raise RuntimeError("Set SHOPIFY_STORE_URL or SHOPIFY_SHOP_NAME (or store_url in pipeline config)")`,
      kwargLines: [
        "        shop_url=store_url,",
        "        private_app_password=_shopify_token,",
      ],
    };
  }

  if (style === "jira_api") {
    const [domainSpec, emailSpec, tokenSpec] = spec.credentials;
    return {
      imports: "",
      setup: `${pyResolveCredential(domainSpec, "_jira_domain")}
${pyResolveCredential(emailSpec, "_jira_email")}
${pyResolveCredential(tokenSpec, "_jira_token")}
    if not _jira_domain or not _jira_email or not _jira_token:
        raise RuntimeError("Set JIRA_DOMAIN, JIRA_EMAIL, and JIRA_API_TOKEN for Jira API access")

    def _jira_subdomain(raw: str) -> str:
        value = (raw or "").strip().lower()
        value = value.removeprefix("https://").removeprefix("http://")
        if value.endswith(".atlassian.net"):
            value = value[: -len(".atlassian.net")]
        return value.split("/")[0].strip()

    subdomain = _jira_subdomain(_jira_domain)
    if not subdomain:
        raise RuntimeError("JIRA_DOMAIN must be a subdomain or *.atlassian.net host")`,
      kwargLines: [
        "        subdomain=subdomain,",
        "        email=_jira_email,",
        "        api_token=_jira_token,",
      ],
    };
  }

  if (style === "slack") {
    const tokenSpec = spec.credentials[0];
    const channels = parseCommaSeparatedConfig(config.channels);
    const includePrivate = config.include_private === true;
    const channelLines =
      channels.length > 0
        ? [`    selected_channels = [${channels.map((c) => `"${escapePyString(c)}"`).join(", ")}]`]
        : ["    selected_channels = None"];
    const kwargLines = ["        access_token=_slack_token,"];
    if (channels.length > 0) {
      kwargLines.push("        selected_channels=selected_channels,");
    }
    if (includePrivate) {
      kwargLines.push("        include_private_channels=True,");
    }
    return {
      imports: "",
      setup: `${pyResolveCredential(tokenSpec, "_slack_token")}
    if not _slack_token:
        raise RuntimeError("Set SLACK_BOT_TOKEN or SLACK_ACCESS_TOKEN for Slack API access")
${channelLines.join("\n")}`,
      kwargLines,
    };
  }

  if (style === "asana_secrets") {
    const tokenSpec = spec.credentials[0];
    return {
      imports: "",
      setup: `${pyResolveCredential(tokenSpec, "_asana_token")}
    if not _asana_token:
        raise RuntimeError("Set ASANA_ACCESS_TOKEN for Asana API access")
    os.environ.setdefault("SOURCES__ASANA_DLT__ACCESS_TOKEN", _asana_token)`,
      kwargLines: [],
    };
  }

  if (style === "workable") {
    const tokenSpec = spec.credentials[0];
    const configuredSubdomain =
      typeof config.subdomain === "string"
        ? config.subdomain.trim()
        : typeof config.account_subdomain === "string"
          ? config.account_subdomain.trim()
          : "";
    const subdomainLiteral = configuredSubdomain ? `"${escapePyString(configuredSubdomain)}"` : "None";
    return {
      imports: "",
      setup: `${pyResolveCredential(tokenSpec, "_workable_token")}
    if not _workable_token:
        raise RuntimeError("Set WORKABLE_ACCESS_TOKEN for Workable API access")
    subdomain = (
        os.environ.get("WORKABLE_ACCOUNT_SUBDOMAIN")
        or os.environ.get("WORKABLE_SUBDOMAIN")
        or ${subdomainLiteral}
    )
    if not subdomain:
        raise RuntimeError("Set WORKABLE_ACCOUNT_SUBDOMAIN or WORKABLE_SUBDOMAIN (or subdomain in pipeline config)")`,
      kwargLines: ["        access_token=_workable_token,", "        subdomain=subdomain,"],
    };
  }

  const credLines: string[] = [];
  const credChecks: string[] = [];
  spec.credentials.forEach((c, i) => {
    const varName = `_cred_${i}`;
    credLines.push(`    ${pyResolveCredential(c, varName)}`);
    credChecks.push(
      `    if not ${varName}:\n        raise RuntimeError("Missing credential for ${escapePyString(c.param)} — set one of: ${c.envKeys.join(", ")}")`
    );
    kwargLines.push(`        ${escapePyString(c.param)}=${varName},`);
  });
  return {
    imports: "",
    setup: [...credLines, ...credChecks].join("\n"),
    kwargLines,
  };
}

export function generateVerifiedSourcePipeline(request: PipelineRequest): string {
  const spec = resolveVerifiedSourceSpec(request.sourceType);
  if (!spec) {
    throw new Error(`No verified source spec for ${request.sourceType}`);
  }

  const config = request.sourceConfiguration;
  const { destination, destinationComment, datasetName } = destinationBlock(request);
  const desc =
    request.description || `Load ${request.sourceType} data to ${request.destinationType}`;

  const credSection = buildCredentialSection(spec, config);
  const kwargLines = [...credSection.kwargLines];

  for (const key of spec.configKeys ?? []) {
    if (spec.credentialStyle === "shopify" && (key === "store_url" || key === "shop")) continue;
    if (spec.credentialStyle === "slack" && (key === "channels" || key === "include_private")) continue;
    if (spec.credentialStyle === "workable" && (key === "subdomain" || key === "account_subdomain")) continue;
    const raw = config[key];
    if (raw === undefined || raw === null || raw === "") continue;
    if (typeof raw === "string") {
      kwargLines.push(`        ${escapePyString(key)}="${escapePyString(raw)}",`);
    } else if (typeof raw === "number" || typeof raw === "boolean") {
      kwargLines.push(`        ${escapePyString(key)}=${raw},`);
    } else if (Array.isArray(raw)) {
      const items = raw.map((x) => `"${escapePyString(String(x))}"`).join(", ");
      kwargLines.push(`        ${escapePyString(key)}=[${items}],`);
    } else {
      kwargLines.push(`        ${escapePyString(key)}=${JSON.stringify(raw)},`);
    }
  }

  let resourceBlock = "";
  if (spec.resourceConfigKey || spec.normalizeResources) {
    const resources = readResourcesForSpec(spec, config);
    if (resources.length) {
      const resourceList = resources.map((r) => `"${escapePyString(String(r))}"`).join(", ");
      resourceBlock = `
    resources_to_load = [${resourceList}]
    source = source.with_resources(*resources_to_load)`;
    }
  }

  const partitionBlock = spec.partitionKwarg
    ? `
    if partition_key:
        source_kwargs["${escapePyString(spec.partitionKwarg)}"] = partition_key`
    : "";

  const extraImport = credSection.imports ? `\n${credSection.imports}` : "";

  return `${eltpulsePythonModuleHeader(request.name, desc)}

import os
import dlt
from ${spec.module} import ${spec.factory}${extraImport}

def run(partition_key: str = None):
    ${destinationComment}
${credSection.setup}

    pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(datasetName)}",
    )

    source_kwargs = dict(
${kwargLines.join("\n")}
    )${partitionBlock}

    source = ${spec.factory}(**source_kwargs)${resourceBlock}

    info = pipeline.run(
        source,
        write_disposition="${escapePyString(request.writeDisposition ?? "append")}",
        loader_file_format="${escapePyString(request.fileFormat ?? "parquet")}",
    )
    print(f"Pipeline completed: {info}")${eltpulseReportLoadInfoPython("info")}${dltDbtRunnerBeforeReturn(request)}${postTransformBeforeReturn(request)}
    return info

if __name__ == "__main__":
    import sys
    partition = sys.argv[1] if len(sys.argv) > 1 else None
    run(partition_key=partition)
`;
}
