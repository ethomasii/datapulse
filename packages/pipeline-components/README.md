# Native pipeline components for eltPulse

Executable pipeline component definitions for [eltPulse](https://github.com/eltpulsehq/datapulse) declarative v2 pipelines.

**Canonical implementation** (TypeScript `compile()` functions) lives in the datapulse monorepo:

`web/lib/elt/native-components/definitions/`

This repository publishes **metadata + form schemas** (`components/*/component.json`) synced from datapulse for discovery, docs, and external tooling.

## Sync from datapulse

**Automatic:** pushing to `main` updates the catalog via GitHub Actions (`sync-pipeline-components` workflow).

**Manual:**

```bash
# One command — export, test, publish:
node scripts/manage-pipeline-components.mjs

# Or step by step:
node scripts/export-pipeline-components-catalog.mjs
node scripts/publish-pipeline-components.mjs
```

Published catalog: [ethomasii/eltpulse-pipeline-components](https://github.com/ethomasii/eltpulse-pipeline-components)

## Layout

```
components/
  join_tables/component.json    # id, fields, compileTarget, aliases
  sql_transform/component.json
  ...
manifest.json                 # component index
```

## Native components

See [manifest.json](./manifest.json) for the current list. Each component compiles to:

| compileTarget | Runtime |
|---------------|---------|
| `python` | Post-load Python in generated `pipeline.py` |
| `quality` | `elt_tests` + SQL validation |
| `monitor` | `elt_canvas_sensors` → EltMonitor |
| `dlt` | Source configuration hints for dlt |
| `sling` | Source configuration hints for Sling |

## Migration from Dagster templates

We reuse [dagster-component-templates](https://github.com/eric-thomas-dagster/dagster-component-templates) **schema.json** for forms and reimplement `component.py` behavior in eltPulse — no Dagster runtime.

## Related

- [datapulse](https://github.com/eltpulsehq/datapulse) — control plane + compilers
- [integrations](https://github.com/eltpulsehq/integrations) — gateway/worker execution
