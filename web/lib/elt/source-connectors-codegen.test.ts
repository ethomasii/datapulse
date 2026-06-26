import { describe, expect, it } from "vitest";
import {
  normalizeHubspotResources,
  normalizeSalesforceResources,
  normalizeShopifyResources,
  normalizeStripeEndpoints,
  normalizeZendeskResources,
} from "./source-resource-mappings";
import { generateStripePipeline } from "./generate-dlt-golden";
import { generateVerifiedSourcePipeline } from "./generate-dlt-verified";
import { resolveVerifiedSourceSpec } from "./verified-source-spec";
import type { PipelineRequest } from "./types";

describe("source-resource-mappings", () => {
  it("maps stripe UI ids to PascalCase endpoints", () => {
    expect(normalizeStripeEndpoints(["customers", "charges", "payment_intents"])).toEqual([
      "Customer",
      "BalanceTransaction",
    ]);
  });

  it("maps salesforce UI objects to dlt resource names", () => {
    expect(normalizeSalesforceResources(["Account", "User", "Case"])).toEqual([
      "account",
      "sf_user",
    ]);
  });
});

describe("generateStripePipeline", () => {
  it("passes endpoints tuple from selected resources", () => {
    const code = generateStripePipeline({
      name: "stripe_sync",
      sourceType: "stripe",
      destinationType: "motherduck",
      sourceConfiguration: { resources: ["customers", "invoices"] },
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain('endpoints=("Customer", "Invoice")');
  });
});

describe("generateVerifiedSourcePipeline connectors", () => {
  it("shopify slug resolves to shopify_dlt import", () => {
    expect(resolveVerifiedSourceSpec("shopify")?.module).toBe("shopify_dlt");
    const code = generateVerifiedSourcePipeline({
      name: "shopify_sync",
      sourceType: "shopify",
      destinationType: "motherduck",
      sourceConfiguration: {
        shop: "my-store.myshopify.com",
        resources: ["orders", "inventory"],
      },
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain("from shopify_dlt import shopify_source");
    expect(code).toContain("shop_url=store_url");
    expect(code).toContain('resources_to_load = ["orders"]');
  });

  it("zendesk uses ZendeskCredentialsToken and zendesk_support", () => {
    const code = generateVerifiedSourcePipeline({
      name: "zd_sync",
      sourceType: "zendesk",
      destinationType: "motherduck",
      sourceConfiguration: { resources: ["tickets", "users"] },
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain("from zendesk import zendesk_support");
    expect(code).toContain("ZendeskCredentialsToken");
    expect(code).toContain('resources_to_load = ["tickets", "users"]');
  });

  it("hubspot honors resource selection", () => {
    const code = generateVerifiedSourcePipeline({
      name: "hs_sync",
      sourceType: "hubspot",
      destinationType: "motherduck",
      sourceConfiguration: { resources: ["contacts", "deals"] },
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain('resources_to_load = ["contacts", "deals"]');
  });

  it("notion uses notion_databases factory", () => {
    const code = generateVerifiedSourcePipeline({
      name: "notion_sync",
      sourceType: "notion",
      destinationType: "motherduck",
      sourceConfiguration: {},
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain("from notion import notion_databases");
  });

  it("salesforce maps standard_objects to with_resources", () => {
    const code = generateVerifiedSourcePipeline({
      name: "sf_sync",
      sourceType: "salesforce",
      destinationType: "motherduck",
      sourceConfiguration: { standard_objects: ["Account", "Contact"] },
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain("SecurityTokenAuth");
    expect(code).toContain('resources_to_load = ["account", "contact"]');
  });
});

describe("normalize helpers", () => {
  it("shopify drops unsupported resources", () => {
    expect(normalizeShopifyResources(["orders", "fulfillments"])).toEqual(["orders"]);
  });

  it("hubspot keeps implemented resources", () => {
    expect(normalizeHubspotResources(["contacts", "companies"])).toEqual(["contacts", "companies"]);
  });

  it("zendesk keeps ticket resources", () => {
    expect(normalizeZendeskResources(["tickets", "groups"])).toEqual(["tickets", "groups"]);
  });
});
