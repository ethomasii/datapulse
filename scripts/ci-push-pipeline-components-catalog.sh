#!/usr/bin/env bash
# Push packages/pipeline-components to pipeline-components-catalog branch (CI + local).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CATALOG_BRANCH="${PIPELINE_COMPONENTS_FALLBACK_BRANCH:-pipeline-components-catalog}"
TMP="$(mktemp -d)"

trap 'rm -rf "$TMP"' EXIT

cp -R "$ROOT/packages/pipeline-components/." "$TMP/"
mkdir -p "$TMP/web"
cp -R "$ROOT/packages/pipeline-components/.vercel-stub/." "$TMP/web/"
cd "$TMP"
git init -b main
git config user.name "${GIT_AUTHOR_NAME:-github-actions[bot]}"
git config user.email "${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"
git add -A
git commit -m "sync pipeline-components catalog from datapulse"

if git ls-remote "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" \
  "refs/heads/${CATALOG_BRANCH}" | grep -q .; then
  git push --force "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" \
    main:"refs/heads/${CATALOG_BRANCH}"
else
  git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" \
    main:"refs/heads/${CATALOG_BRANCH}"
fi

echo "Pushed ${CATALOG_BRANCH} on ${GITHUB_REPOSITORY}"
