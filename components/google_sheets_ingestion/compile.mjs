// web/lib/elt/native-components/definitions/ingestion-hints.ts
var googleSheetsIngestComponent = {
  id: "google_sheets_ingestion",
  name: "Google Sheets ingest",
  category: "ingestion",
  description: "Merge Google Sheets spreadsheet hints for dlt sheets source.",
  compileTarget: "dlt",
  fields: [
    { key: "spreadsheet_id", label: "Spreadsheet ID", type: "string", required: true },
    { key: "sheet_names", label: "Sheet names", type: "string_list" },
    { key: "credentials_path", label: "Service account JSON path", type: "string" },
    { key: "resource_name", label: "Destination table name", type: "string" }
  ],
  compile(config) {
    const spreadsheetId = String(config.spreadsheet_id ?? config.sheet_id ?? "").trim();
    if (!spreadsheetId) {
      return { warnings: ["google_sheets_ingestion: spreadsheet_id is required"], configPatch: {} };
    }
    const sheetNames = Array.isArray(config.sheet_names) ? config.sheet_names.map(String).filter(Boolean) : String(config.sheet_names ?? config.range ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return {
      configPatch: {
        elt_native_ingestion: "google_sheets",
        spreadsheet_id: spreadsheetId,
        ...sheetNames.length ? { sheet_names: sheetNames.join(",") } : {},
        ...config.credentials_path ? { google_credentials_path: String(config.credentials_path) } : {},
        resource_name: String(config.resource_name ?? "google_sheets_data")
      }
    };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/google_sheets_ingestion.ts
function compile(config) {
  return googleSheetsIngestComponent.compile(config);
}
export {
  compile
};
