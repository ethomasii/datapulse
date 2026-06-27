/**
 * GitHub Actions workflow: sync production pipeline YAML into eltPulse after merge to main.
 * Place in your pipelines repo at `.github/workflows/eltpulse-sync-prod.yml`.
 */
export function eltpulseSyncProductionWorkflow(opts: {
  productionBranch?: string;
  appUrl?: string;
}): string {
  const branch = opts.productionBranch?.trim() || "main";
  const appUrl = opts.appUrl?.trim() || "https://app.eltpulse.dev";

  return `# Sync pipeline declarations from Git into eltPulse after promoting to production.
# Requires a workspace API key with pipeline write scope (Settings → API keys).
#
# Secrets:
#   ELTPULSE_API_KEY — workspace API key
#   ELTPULSE_URL     — optional; defaults to ${appUrl}

name: eltPulse sync production

on:
  push:
    branches: [${branch}]
    paths:
      - 'eltpulse/pipelines/**'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Pull declarations into eltPulse
        env:
          ELTPULSE_URL: \${{ secrets.ELTPULSE_URL || '${appUrl}' }}
          ELTPULSE_API_KEY: \${{ secrets.ELTPULSE_API_KEY }}
        run: |
          set -euo pipefail
          if [ -z "\${ELTPULSE_API_KEY:-}" ]; then
            echo "ELTPULSE_API_KEY secret is required"
            exit 1
          fi
          curl -sf -X POST "\${ELTPULSE_URL}/api/integrations/github/sync" \\
            -H "Authorization: Bearer \${ELTPULSE_API_KEY}" \\
            -H "Content-Type: application/json" \\
            -d '{"action":"pull_declarations"}'
          echo "Synced eltpulse/pipelines from ${branch}"
`;
}
