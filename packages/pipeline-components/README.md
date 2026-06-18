# Native pipeline components for eltPulse

Executable **component packages** for [eltPulse](https://github.com/ethomasii/datapulse) declarative v2 pipelines.

## Package = schema + implementation

Each component is a folder with **both** files:

```
components/my_component/
  component.json   # form fields, compileTarget, metadata
  compile.mjs      # export function compile(config) → { python, sql, tests, ... }
```

eltPulse fetches `compile.mjs` from this repo at pipeline save time (sandboxed) and merges output into generated `pipeline.py`. **No datapulse PR required** to add new components.

See [examples/component-packages.md](https://github.com/ethomasii/datapulse/blob/main/examples/component-packages.md) in the monorepo.

Built-in TS compilers in datapulse are a fallback when no `compile.mjs` exists in the catalog.

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
