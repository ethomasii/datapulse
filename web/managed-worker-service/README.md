# eltPulse managed worker (Python)

Runs **real dlt/Sling/dbt** for eltPulse-managed pipeline runs. The control plane dispatches work via `POST /batch`.

## Where this runs

| Backend | When | Setup |
|--------|------|--------|
| **GitHub Actions** | Dogfood / bootstrap on Vercel | `ELTPULSE_GITHUB_DISPATCH_TOKEN` + repo secrets (current) |
| **AWS ECS / Fargate** | Production eltPulse compute | Build this Dockerfile → set `ELTPULSE_MANAGED_DELEGATE_URL=https://workers…/batch` |
| **Separate Vercel project** | Small Python fleet on Vercel | Deploy this folder; same delegate URL |
| **Local dev** | `npm run managed-worker:local` | `ELTPULSE_MANAGED_EXECUTOR=local` |

**Vercel (Next.js app) is not a Python runtime.** The control plane is Node/Next.js. It queues runs and calls a **worker** (GHA, ECS, or external URL). Co-located Python HTTP on the same Vercel project was replaced by `/eltpulse-compute/batch` (Node) + GHA/ECS workers.

## ECS / Fargate (recommended production)

```bash
cd web/managed-worker-service
docker build -t eltpulse-managed-worker .
# Push to ECR, run as a service with:
#   ELTPULSE_CONTROL_PLANE_URL=https://www.eltpulse.dev
#   ELTPULSE_INTERNAL_API_SECRET=<same as Vercel>
```

On the **control plane** (Vercel):

- `ELTPULSE_MANAGED_DELEGATE_URL` → `https://your-alb-or-service/batch`
- `ELTPULSE_MANAGED_DELEGATE_SECRET` → bearer token the worker validates on `POST /batch`

Unset `ELTPULSE_GITHUB_DISPATCH_TOKEN` when ECS is primary (optional fallback).

## Verified dlt sources (fast cold start)

Pre-vendored under `verified_sources/` (no `dlt init` network hit at run time):

- `github` — quick-start GitHub → warehouse
- `stripe_analytics` — Stripe golden path

Add more:

```bash
python web/managed-worker-service/scripts/vendor-verified-sources.py hubspot pipedrive
pip install -r web/managed-worker-service/verified-sources-requirements.txt
```

Pipelines that import other verified packages still work via runtime `dlt init` fallback (slower).

**Core dlt sources** (`rest_api`, `sql_database`) ship inside `dlt` — no vendoring.

**AI-built REST API pipelines** use `dlt.sources.rest_api` — no vendoring.

## HTTP

- `GET /health`
- `POST /batch` — `Authorization: Bearer <ELTPULSE_MANAGED_DELEGATE_SECRET or ELTPULSE_INTERNAL_API_SECRET>`

Body: `{ "limit": 5, "deadlineMs": 900000, "runId": "optional" }`

## CLI (GitHub Actions / cron)

```bash
ELTPULSE_CONTROL_PLANE_URL=… ELTPULSE_INTERNAL_API_SECRET=… python main.py
```
