# Component packages (community extensibility)

Add executable pipeline components **without** a datapulse PR. Publish to a GitHub catalog repo (e.g. [ethomasii/eltpulse-pipeline-components](https://github.com/ethomasii/eltpulse-pipeline-components)) or your own.

## Package layout

```
components/
  my_transform/
    component.json    # schema + metadata (exported from datapulse or hand-written)
    compile.mjs       # export function compile(config) { return { python: [...] } }
    example.yaml      # optional docs
manifest.json
```

## `compile.mjs` contract

```javascript
/**
 * @param {Record<string, unknown>} config — canvas / YAML component config
 * @returns {{
 *   python?: string[],
 *   sql?: string[],
 *   tests?: string[],
 *   quality?: Array<{ table: string, not_null?: string[], unique?: string[] }>,
 *   configPatch?: Record<string, unknown>,
 *   warnings?: string[]
 * }}
 */
export function compile(config) {
  return {
    python: [
      "# my step",
      "print('hello from community component')",
    ],
  };
}
```

Return shape matches built-in native compilers. Output merges into `post_transform`, `elt_tests`, `elt_canvas_sensors`, etc. — same as first-party components.

## Resolution order

When a pipeline saves / generates artifacts:

1. **Remote package** — fetch `compile.mjs` from configured catalog URLs (sandboxed VM)
2. **Built-in TS** — fallback in `web/lib/elt/native-components/definitions/`
3. **Spec only** — Dagster catalog entry with no compiler

Package wins over built-in when both exist (lets you override / migrate off core).

## Catalog URLs

Default: `ethomasii/eltpulse-pipeline-components` (from bundled manifest).

Additional sources:

```yaml
# pipeline sourceConfiguration
component_catalog_urls:
  - acme-corp/our-elt-components
  - https://github.com/partner/components/tree/v2
```

Environment (platform admin):

```
ELTPULSE_COMPONENT_CATALOG_URLS=acme/components,partner/extra-components
```

Future: org workspace setting in UI for customer BYO repos.

## Authoring workflow

1. Add `components/my_id/component.json` + `compile.mjs` to your catalog repo
2. Add `my_id` to `manifest.json` `components` array
3. Push — CI on datapulse syncs; eltPulse fetches on next pipeline save

Or develop in datapulse monorepo under `packages/pipeline-components/components/` and run:

```bash
node scripts/publish-pipeline-components.mjs
```

## Security

- `compile.mjs` runs in a **timeout sandbox** on the control plane (no `require`, no network)
- Trust catalog URLs you configure; use pinned branches/tags for production
- Self-hosted gateways may allow local catalog paths later

## vs Dagster templates

| Dagster | eltPulse package |
|---------|------------------|
| `schema.json` | `component.json` |
| `component.py` | `compile.mjs` |
| Dagster runtime | → `pipeline.py` on your worker |
