// web/lib/elt/native-components/definitions/ingestion-hints.ts
var restApiIngestComponent = {
  id: "rest_api_fetcher",
  name: "REST API fetch",
  category: "ingestion",
  description: "Merge REST API source hints for dlt rest_api connector.",
  compileTarget: "dlt",
  fields: [
    { key: "base_url", label: "Base URL", type: "string", required: true },
    { key: "endpoint", label: "Endpoint path", type: "string", default: "/" },
    { key: "resource_name", label: "Resource name", type: "string", required: true },
    {
      key: "pagination_type",
      label: "Pagination",
      type: "select",
      options: ["auto", "cursor", "offset", "none"],
      default: "auto"
    },
    { key: "data_selector", label: "Data JSON path", type: "string", placeholder: "data" }
  ],
  compile(config) {
    const baseUrl = String(config.base_url ?? "").trim();
    const resourceName = String(config.resource_name ?? config.table_name ?? "").trim();
    if (!baseUrl || !resourceName) {
      return { warnings: ["rest_api_fetcher: base_url and resource_name required"], configPatch: {} };
    }
    return {
      configPatch: {
        elt_native_ingestion: "rest_api",
        base_url: baseUrl,
        endpoint: String(config.endpoint ?? "/"),
        resource_name: resourceName,
        pagination_type: String(config.pagination_type ?? "auto"),
        ...config.data_selector ? { data_selector: String(config.data_selector) } : {}
      }
    };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/rest_api_fetcher.ts
function compile(config) {
  return restApiIngestComponent.compile(config);
}
export {
  compile
};
