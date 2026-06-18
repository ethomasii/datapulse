# eltPulse pipeline components (native repo)

Future home for **executable** pipeline component definitions, split from the Dagster discovery catalog.

## Layout

```
components/
  join_tables/
    component.json     # id, aliases, fields, compileTarget
    compile.ts         # compile(config) → python | sql | configPatch
  sql_transform/
    ...
manifest.json          # index for sync into datapulse
```

## Today

Source of truth lives in the monorepo at:

`web/lib/elt/native-components/definitions/`

Sync script (bundles into web app):

```bash
node scripts/sync-native-components.mjs
```

## Migration from dagster-component-templates

1. Copy `schema.json` → derive `fields` (or use `dagster-schema.ts` parser at runtime).
2. Reimplement `component.py` as `compile()` emitting Python/SQL/dlt hints — **do not** import Dagster.
3. Add `aliases[]` for manifest ids (`dataframe_join` → `join_tables`).
4. Register in `manifest.json` with `compileTarget`: dlt | sling | python | quality | monitor.

## Native components (v1)

| id | compileTarget |
|----|---------------|
| join_tables | python |
| filter_rows | python |
| sql_transform | sql |
| select_columns | python |
| drop_duplicates | python |
| union_tables | python |
| dq_check | quality |
| freshness_check | quality |
| unique_check | quality |
| s3_monitor | monitor |
| sqs_monitor | monitor |
| gcs_monitor | monitor |
| s3_to_database_asset | dlt hints |
| sql_to_database_asset | sling hints |

## Publishing

CI pushes to `eltpulsehq/pipeline-components` (planned), same pattern as `eltpulsehq/integrations`.
