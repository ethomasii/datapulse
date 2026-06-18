# pipeline-components monorepo sync

The canonical **customer-facing** repo is [github.com/ethomasii/eltpulse-pipeline-components](https://github.com/ethomasii/eltpulse-pipeline-components).

Until that standalone repo exists, catalog publishes to branch `pipeline-components-catalog` on [ethomasii/datapulse](https://github.com/ethomasii/datapulse) as a fallback.

Executable compilers live in the datapulse monorepo (`web/lib/elt/native-components/definitions/`). This folder holds **exported metadata** (`components/*/component.json`) for discovery and external tooling.

## Publish workflow

1. Add or change a native component in `web/lib/elt/native-components/definitions/` and register in `registry.ts`.
2. Push to `main` — CI exports and publishes the catalog branch automatically.
3. Or run locally: `node scripts/manage-pipeline-components.mjs`

Manual alternative (same pattern as `integrations/`):

```bash
cd packages/pipeline-components
rsync -a --delete --exclude '.git' ./ /tmp/pipeline-components-push/
cd /tmp/pipeline-components-push && git init && git remote add origin git@github.com:ethomasii/eltpulse-pipeline-components.git
git add -A && git commit -m "sync from datapulse" && git branch -M main && git push -u origin main
```

Pick one direction (export-from-datapulse vs pull-into-datapulse) and stick to it.

## CI

The external repo runs `.github/workflows/validate-manifest.yml` to ensure `manifest.json` matches `components/` directories.
