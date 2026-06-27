# Not the eltPulse web app

This folder exists only on branch `pipeline-components-catalog` so Vercel’s **Root Directory** (`web`) resolves.

The real Next.js app lives on `main`. This branch publishes [pipeline component packages](../) for remote `compile.mjs` fetch — see `packages/pipeline-components/MONOREPO.md`.

`vercel.json` sets `"git.deploymentEnabled": false` so pushes to this branch do not trigger app builds.
