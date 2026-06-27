import type { PipelineRequest } from "./types";
import { escapePyString } from "./escape-py";
import { dltDbtRunnerBeforeReturn } from "./generate-dlt-dbt-append";
import { eltpulseReportLoadInfoPython } from "./generate-eltpulse-run-reporting";
import { postTransformBeforeReturn } from "./generate-post-transform";
import { eltpulsePythonModuleHeader } from "./codegen-branding";

export function isIcebergSource(sourceType: string): boolean {
  return sourceType.toLowerCase().trim() === "iceberg";
}

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
    request.schemaOverride || "iceberg_data".replace(/[^a-zA-Z0-9_]/g, "_");
  return { destination, destinationComment, datasetName };
}

/** PyIceberg scan pipeline for Iceberg tables on object-store warehouses. */
export function generateIcebergPipeline(request: PipelineRequest): string {
  const config = request.sourceConfiguration;
  const warehouse = String(config.warehouse ?? "s3://YOUR_LAKE/warehouse/");
  const catalogType = String(config.catalog ?? "rest").toLowerCase();
  const namespace = String(config.namespace ?? "default").trim() || "default";
  const tableName = String(config.table ?? "").trim();
  const sliceColumn = String(config.slice_column ?? config.partition_column ?? "").trim();
  const { destination, destinationComment, datasetName } = destinationBlock(request);
  const desc =
    request.description || `Load Iceberg tables from ${warehouse} to ${request.destinationType}`;

  const tablesPy = tableName
    ? `table_names = ["${escapePyString(tableName)}"]`
    : `table_names = [t[-1] if isinstance(t, tuple) else str(t) for t in catalog.list_tables("${escapePyString(namespace)}")]`;

  return `${eltpulsePythonModuleHeader(request.name, desc)}

import os
import dlt

def run(partition_key: str = None):
    # partition_key: optional day (YYYY-MM-DD) — filters rows via slice_column when configured.
    try:
        from pyiceberg.catalog import load_catalog
    except ImportError as exc:
        raise RuntimeError(
            "pyiceberg is required for Iceberg source pipelines. "
            "Install verified-sources-requirements.txt on the managed worker."
        ) from exc

    ${destinationComment}
    pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(datasetName)}",
    )

    warehouse = "${escapePyString(warehouse)}"
    catalog_type = "${escapePyString(catalogType)}"
    slice_column = "${escapePyString(sliceColumn)}"

    catalog_props = {"warehouse": warehouse}
    if catalog_type == "rest":
        rest_uri = os.environ.get("ICEBERG_REST_URI") or os.environ.get("CATALOG_URI")
        if not rest_uri:
            raise RuntimeError("Set ICEBERG_REST_URI for REST Iceberg catalog.")
        catalog_props = {"uri": rest_uri, "warehouse": warehouse}
        catalog = load_catalog("default", **catalog_props)
    elif catalog_type == "glue":
        catalog = load_catalog(
            "default",
            type="glue",
            warehouse=warehouse,
            **({"region_name": os.environ.get("AWS_REGION")} if os.environ.get("AWS_REGION") else {}),
        )
    elif catalog_type == "nessie":
        nessie_uri = os.environ.get("ICEBERG_REST_URI") or os.environ.get("NESSIE_URI")
        if not nessie_uri:
            raise RuntimeError("Set ICEBERG_REST_URI or NESSIE_URI for Nessie catalog.")
        catalog = load_catalog("default", uri=nessie_uri, warehouse=warehouse)
    else:
        catalog = load_catalog("default", type="hive", warehouse=warehouse)

    ${tablesPy}
    if not table_names:
        raise RuntimeError(f"No tables found in namespace ${escapePyString(namespace)}")

    end_val = None
    if partition_key and len(partition_key.strip()) >= 10:
        from datetime import date, timedelta
        pk = partition_key.strip()
        try:
            _day = date.fromisoformat(pk[:10])
            end_val = (_day + timedelta(days=1)).isoformat()
        except ValueError:
            end_val = None

    last_info = None
    for tbl_name in table_names:
        identifier = "${escapePyString(namespace)}." + tbl_name
        iceberg_table = catalog.load_table(identifier)

        row_filter = None
        if partition_key and slice_column:
            pk = partition_key.strip()[:10]
            if end_val:
                row_filter = f"{slice_column} >= '{pk}' AND {slice_column} < '{end_val[:10]}'"
            else:
                row_filter = f"{slice_column} >= '{pk}'"

        scan = iceberg_table.scan(row_filter=row_filter) if row_filter else iceberg_table.scan()
        arrow_table = scan.to_arrow()

        def _make_resource(name, table):
            @dlt.resource(name=name, write_disposition="append")
            def _rows():
                batch_size = 1000
                rows = table.to_pylist()
                for i in range(0, len(rows), batch_size):
                    yield rows[i : i + batch_size]
            return _rows

        last_info = pipeline.run(_make_resource(tbl_name, arrow_table))

    print(f"Pipeline completed: {last_info}")${eltpulseReportLoadInfoPython("last_info")}${dltDbtRunnerBeforeReturn(request)}${postTransformBeforeReturn(request)}
    return last_info

if __name__ == "__main__":
    import sys
    partition = sys.argv[1] if len(sys.argv) > 1 else None
    run(partition_key=partition)
`;
}
