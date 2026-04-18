# eltPulse gateway (reference implementation)

This directory is the **gateway** process customers run in their environment: it talks to the eltPulse control plane over **HTTPS** using a named connector token.

Published image: **`ghcr.io/eltpulsehq/gateway:latest`** (built from this folder by the integrations repo’s GitHub Actions).

- **Node 20+**; install **`@aws-sdk/client-s3`** and **`@aws-sdk/client-sqs`** for S3/SQS monitor evaluation on the gateway (`npm install` in this folder).
- Calls the control plane routes under **`/api/agent/*`** (URL path is fixed; the product name is **gateway**).

## Run locally

```bash
cd integrations/gateway
npm install
export ELTPULSE_AGENT_TOKEN="…"
export ELTPULSE_CONTROL_PLANE_URL="https://app.eltpulse.dev"
# Optional: stub-complete pending runs (demos only)
# export ELTPULSE_EXECUTE_RUNS=1
# Optional: disable gateway-side monitor polling (default: on when monitors resolve to customer gateway)
# export ELTPULSE_EVAL_MONITORS=0

node src/index.mjs
```

`ELTPULSE_AGENT_TOKEN` matches the variable name used in Docker Compose samples and the in-app Gateway copy-paste.

## Docker

```bash
docker build -t eltpulse-gateway:local .
docker run --rm -e ELTPULSE_AGENT_TOKEN -e ELTPULSE_CONTROL_PLANE_URL eltpulse-gateway:local
```

## Publish to GHCR

See **[`.github/workflows/publish-ghcr.yml`](../.github/workflows/publish-ghcr.yml)** at the integrations repo root.

## Safety

By default the process **does not** change run status. **`ELTPULSE_EXECUTE_RUNS=1`** enables the stub that marks pending runs **succeeded** — use only for smoke tests.

**Run telemetry:** the stub also sends sample `telemetrySummary` / `appendTelemetrySample` payloads on each PATCH so the control plane can chart progress. Real workers should PATCH the same fields (rows, bytes, progress, phase) every few seconds while a run is `running` — identical contract to `PATCH /api/elt/runs/:id` for the app API.

**Monitors:** when your manifest resolves a monitor to the customer gateway (per-monitor `executionHost` + account `executionPlane`), this process polls S3/SQS and **`POST /api/agent/monitors/:id/report`**. Disable with **`ELTPULSE_EVAL_MONITORS=0`** if needed.

## Managed runs (`ingestionExecutor: eltpulse_managed`)

Runs marked for **eltPulse-managed** execution are **not** returned by `GET /api/agent/runs` for customer Bearer tokens, so a self-hosted gateway will not accidentally stub-complete them.

eltPulse’s own worker fleet should use the **internal** control-plane APIs (same deployment secret as `POST /api/internal/agent-heartbeat`):

- `GET /api/internal/managed-runs?limit=5` — pending managed runs with full pipeline manifest (+ owning `user` id/email for tenancy).
- `PATCH /api/internal/managed-runs/:id` — same patch contract as `PATCH /api/agent/runs/:id`, but **preserves** managed `ingestionExecutor` (customer agent routes force `customer_agent`).

Those workers still need a **real executor** (spawn dlt in Docker/K8s, etc.); this repo’s reference gateway continues to use `stubCompleteRun` unless you replace it.

## Dispatcher vs isolated workers

For **ECS / Kubernetes / Docker**, keep the long-lived process as a **dispatcher** only: set **`pipelineRunIsolation`** / **`monitorCheckIsolation`** to **`spawn`** on the named gateway token’s JSON metadata (surfaced in **`GET /api/agent/manifest`** as `executorHints`), or override with env on the host:

| Variable | Values | Purpose |
|----------|--------|---------|
| `ELTPULSE_PIPELINE_RUN_ISOLATION` | `inline` (default) \| `spawn` | Run pending pipelines in-process vs dispatch. |
| `ELTPULSE_MONITOR_CHECK_ISOLATION` | `inline` (default) \| `spawn` | Evaluate S3/SQS monitors in-process vs dispatch. |
| `ELTPULSE_PIPELINE_RUN_SPAWN_COMMAND` | shell | If `spawn`: run this command; templates `{{RUN_ID}}`, `{{CONTROL_PLANE_URL}}` (e.g. script that calls `aws ecs run-task` or `kubectl create job`). |
| `ELTPULSE_PIPELINE_RUN_DOCKER_IMAGE` | image ref | If `spawn` and no shell command: `docker run` that image with **`ELTPULSE_SINGLE_RUN_ID`** (one-shot worker mode). |
| `ELTPULSE_MONITOR_CHECK_SPAWN_COMMAND` | shell | Templates `{{MONITOR_ID}}`, `{{CONTROL_PLANE_URL}}`. |
| `ELTPULSE_MONITOR_CHECK_DOCKER_IMAGE` | image ref | `docker run` with **`ELTPULSE_SINGLE_MONITOR_ID`**. |

**One-shot worker env** (same image / entrypoint): `ELTPULSE_SINGLE_RUN_ID` or `ELTPULSE_SINGLE_MONITOR_ID` plus token and control plane URL — process completes one unit of work and exits (ideal for ephemeral tasks).

If `spawn` is set but **no** docker image and **no** spawn command are configured, pipeline runs stay **pending** and a **warning** is logged (so you do not silently fall back to in-process execution).
