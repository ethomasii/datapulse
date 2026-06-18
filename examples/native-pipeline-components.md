# Native pipeline components

eltPulse-native components live in `web/lib/elt/native-components/`. They are **executable** definitions migrated from [dagster-component-templates](https://github.com/eric-thomas-dagster/dagster-component-templates): we reuse Dagster `schema.json` for forms and reimplement behavior as dlt/Sling/post-transform Python/SQL — **not** a Dagster runtime.

## Migration model

| Dagster template | eltPulse native | Runtime |
|------------------|-----------------|---------|
| `schema.json` attributes | Form fields (or `native-components/definitions/*.ts` fields) | UI |
| `component.py` logic | TypeScript `compile()` → Python/SQL strings | Managed worker / gateway |
| `example.yaml` | Declarative v2 `components:` block | GitOps YAML |
| Manifest id | `id` + `aliases[]` in registry | Catalog + canvas |

## Implemented today (14 native)

| Component id | Aliases | Compiles to |
|--------------|---------|-------------|
| `join_tables` | `dataframe_join` | Post-load pandas join |
| `filter_rows` | `dataframe_filter`, `row_filter` | Post-load pandas filter |
| `sql_transform` | `sql_command_job`, `sql_generator` | Post-load SQL |
| `select_columns` | — | Column projection |
| `drop_duplicates` | `unique_dedup`, `warehouse_dedup` | Deduplication |
| `union_tables` | `dataframe_union` | pandas concat |
| `dq_check` | `great_expectations_check`, `soda_check` | `elt_tests` + SQL |
| `freshness_check` | — | Freshness SQL check |
| `unique_check` | — | Unique constraint tests |
| `s3_monitor` | — | `elt_canvas_sensors` → EltMonitor |
| `sqs_monitor` | — | SQS monitor metadata |
| `gcs_monitor` | — | GCS monitor metadata |
| `s3_to_database_asset` | `csv_file_ingestion` | dlt filesystem ingest hints |
| `sql_to_database_asset` | — | Sling table replication hints |

## Repo layout

- **Definitions:** `web/lib/elt/native-components/definitions/`
- **Future external repo:** `packages/pipeline-components/` (see README)
- **Sync:** `node scripts/sync-native-components.mjs` → `web/lib/elt/data/native-components-manifest.json`

## Adding a component

1. Create `web/lib/elt/native-components/definitions/my-component.ts` with `fields` + `compile()`.
2. Register in `registry.ts`.
3. Add to `packages/pipeline-components/manifest.json`.
4. Run `node scripts/sync-native-components.mjs`.

## Compile hook

On artifact generation (`generate-artifacts.ts`), `compileNativePipelineComponents()` reads `sourceConfiguration.elt_components`, runs native compilers in topo order, and merges into:

- `post_transform` (Python/SQL in generated `pipeline.py`)
- `elt_tests` / `elt_quality`
- `elt_canvas_sensors` / ingestion hints via `configPatch`

## Catalog honesty

Components **without** a native compiler show **SPEC ONLY** in the canvas inspector. Prefer native ids in AI prompts and the component palette **native** badge.
