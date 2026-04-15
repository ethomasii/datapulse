# Scaling the eltPulse control plane (multi-tenant, eltPulse-managed)

This document is for **operators** hosting the Next.js app (e.g. Vercel) plus Postgres (e.g. Neon): many customers on **eltPulse-managed** execution should get predictable latency, fair sharing, and room to grow without one noisy tenant taking down cron or API routes.

## What scales today

| Layer | Pattern |
|--------|---------|
| **HTTP API** | Stateless Next.js routes: scale **instance count** horizontally; every request scopes data by authenticated user / org (`userId` in Prisma queries). |
| **Database** | Use a **pooled** connection string for serverless (Neon pooler); consider **read replicas** later for heavy read dashboards without touching write path. |
| **Managed monitor checks** | `GET /api/cron/monitors` evaluates **cloud-side** monitors (S3/SQS) and enqueues runs. It is **shardable** and **time-budgeted** (below). |

## Managed monitor cron: sharding

One invocation walks all monitors that pass placement + interval filters. As tenant count grows, either:

- **Raise** `maxDuration` on that route (Vercel plan limits), and/or  
- **Shard** the same schedule across **N** invocations that each handle a disjoint subset.

**Stable sharding** uses `userId` + `monitorId` so each monitor always maps to the same bucket:

- Query: `GET /api/cron/monitors?shard=0&shards=4` … `shard=3&shards=4`  
- Or env: `CRON_MONITOR_SHARD_INDEX`, `CRON_MONITOR_SHARD_COUNT` (1–64)

Configure **N** Vercel crons (or an external scheduler hitting the same path with different query strings), all with the same `CRON_SECRET`. Each response includes `shard`, `skippedByShard`, and `cloudEvaluated` for observability.

## Managed monitor cron: wall-clock budget

To avoid running out of serverless time mid-update, you can cap wall time per invocation; monitors not reached keep their previous `lastCheckAt` and run on a **later** tick.

- Query: `?budgetMs=90000`  
- Or env: `CRON_MONITOR_MAX_MS` (milliseconds, 5000–300000)

Leave unset for **no** budget (current default). Combine with **shards** so each short invocation finishes within limits.

## Managed **pipeline** execution (ingestion)

Runs with `ingestionExecutor: eltpulse_managed` are **metadata + scheduling** in this repo today; **heavy ingestion** should run on a **separate worker fleet** (containers, queue consumers) that:

1. Pulls work from a **queue** (SQS, Cloud Tasks, Vercel Background, etc.) keyed by `runId`, not from the web process.
2. Uses **idempotent** claim semantics (`UPDATE … WHERE status = 'pending' RETURNING *`) so duplicate workers do not double-run.
3. Reports progress via existing **`PATCH /api/...`** run APIs or internal equivalents.

The web tier then stays thin: auth, CRUD, webhooks, cron **fan-out**, and enqueue only.

## Security and fairness

- **Always** require `CRON_SECRET` in production for `/api/cron/*` (Bearer match).
- **Per-tenant rate limits** on expensive routes (optional middleware) reduce blast radius.
- **Sensor floor** (plan tier + org override) already limits how often cloud checks hit S3/SQS per user.

## Related docs

- [Gateway runtimes](./gateway-runtimes.md) — customer-side dispatch vs inline workers.
- `web/vercel.json` — default monitor cron schedule (`*/5 * * * *`).
