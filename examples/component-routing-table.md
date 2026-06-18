# Component → compiler routing (top templates)

Templates from [dagster-component-templates](https://github.com/eric-thomas-dagster/dagster-component-templates) are **discovery + config UX** by default. **Native** components (see `examples/native-pipeline-components.md`) compile to executable Python/SQL on the managed worker.

## Category defaults

| Category | Compile target | Engine |
|----------|----------------|--------|
| ingestion / source | `dlt` | dlt hub source or Sling replication |
| sink | `dlt` | dlt destination write |
| check | `quality` | Declarative `quality` block + data contracts |
| sensor / observation | `monitor` | EltMonitor YAML |
| dbt | `dbt` | DbtProject / in-pipeline dlt_dbt |
| external | `catalog_external` | Catalog external asset introspect |
| transformation / analytics / ai | `python` | Post-load Python on managed worker |
| infrastructure / integration | `dagster` | Badge: needs Dagster or custom ops |
| resource | `skip` | Use eltPulse Connections |

## Top 20 curated routes

| Component ID | Category | Target | Notes |
|--------------|----------|--------|-------|
| `s3_to_database_asset` | ingestion | dlt | S3/filesystem → workspace destination |
| `sqs_to_database_asset` | ingestion | dlt | Queue → warehouse |
| `kafka_to_database_asset` | ingestion | dlt | Streaming ingest |
| `sql_to_database_asset` | ingestion | sling | DB replication |
| `rest_api_fetcher` | ingestion | dlt | rest_api source |
| `csv_file_ingestion` | ingestion | dlt | filesystem source |
| `s3_monitor` | sensor | monitor | Triggers paired S3 ingest pipeline |
| `sqs_monitor` | sensor | monitor | SQS depth / age |
| `kafka_monitor` | sensor | monitor | Consumer lag |
| `gcs_monitor` | sensor | monitor | GCS file arrival |
| `great_expectations_check` | check | quality | GE-style expectations |
| `soda_check` | check | quality | Soda checks in spec |
| `dq_check` | check | quality | SQL / not_null |
| `freshness_check` | check | quality | SLA + observability alert |
| `dbt_docs_enriched_project` | dbt | dbt | Workspace DbtProject |
| `filter_rows` | transformation | python | Pandas post-transform |
| `join_tables` | transformation | python | Pandas join step |
| `external_snowflake_table` | external | catalog_external | External table asset |
| `warehouse_schema_assets` | external | catalog_external | Schema discovery sync |
| `litellm_inference_asset` | ai | dagster | LLM batch — Dagster or custom Python |

## Sensor ↔ ingestion pairs

Monitors compile from sensor templates and **trigger the paired ingestion pipeline** (see `component-sensor-pairs.ts`):

- `s3_monitor` → `s3_to_database_asset`
- `sqs_monitor` → `sqs_to_database_asset`
- `kafka_monitor` → `kafka_to_database_asset`
- … (full list in `SENSOR_INGESTION_PAIRS`)

Workflow DAGs can chain monitor → downstream pipelines after trigger (`EltWorkflow` + `elt-workflow-runner.ts`).

## Canvas I/O

Port rules come from bundled `component-schema-spec.json` (`connectors.byCategory`):

- **ingestion / source**: left only (upstream)
- **sink / destination**: right only
- **transformation / check / dbt**: left + right (middle of graph)

## API

- `GET /api/elt/components?q=&category=&compileTarget=` — search palette
- `GET /api/elt/components/:id?includeSchema=1` — detail + remote schema.json

Refresh manifest: `node scripts/sync-component-manifest.mjs`
