# eltPulse gateway runtimes (Dagster+–style)

This document describes how we want **self-hosted execution** to feel for customers: similar in spirit to [Dagster+ hybrid agents](https://docs.dagster.io/deployment/dagster-plus/hybrid) (ECS, Kubernetes, Docker/local), but with **egress-only** connectivity to the eltPulse control plane.

**Canonical gateway implementation** lives in **[`eltpulsehq/integrations` → `gateway/`](https://github.com/eltpulsehq/integrations/tree/main/gateway)** (same repo as Docker/K8s/ECS samples). The container image is **`ghcr.io/eltpulsehq/gateway:latest`**, built by that repo’s GitHub Actions. This file is the in-repo product map.

## Control plane vs gateway

| Piece | Role |
|--------|------|
| **eltPulse app** (this repo / Vercel) | Auth, pipelines, runs, secrets references, webhooks, **no** inbound connections to customer networks. |
| **Gateway** (customer infra) | Long-lived process in **your** VPC/cluster/laptop: **outbound HTTPS** to the control plane’s **`/api/agent/*`** routes, polls pending runs, pulls connection secrets, executes ingestion, reports heartbeats and run status. |

No inbound firewall rules are required for the control plane to reach your network. The gateway only **egresses** to eltPulse (and to data sources/warehouses you configure).

## Runtime matrix (target shape)

Same **gateway image** and **Bearer token**; different **where** you run it:

| Runtime | When to use | How we document it (eltpulsehq) |
|---------|-------------|----------------------------------|
| **ECS** | AWS, Fargate or EC2-backed tasks, IAM-scoped | Task definition, service, secrets, egress SG to eltPulse + data plane. |
| **Kubernetes** | K8s clusters, Helm/GitOps | Deployment, `ELTPULSE_*` env, optional NetworkPolicy egress-only. |
| **Local / Docker** | Dev laptops, air-gapped jump hosts, CI | Docker Compose or `docker run` — see [`gateways/local`](https://github.com/eltpulsehq/integrations/tree/main/gateways/local), [`gateways/docker`](https://github.com/eltpulsehq/integrations/tree/main/gateways/docker), and source [`gateway/`](https://github.com/eltpulsehq/integrations/tree/main/gateway). Image **`ghcr.io/eltpulsehq/gateway:latest`**; verify with `docker pull`. |

Each runtime is **documentation + example manifests** (and the **gateway** image build) in [`eltpulsehq/integrations`](https://github.com/eltpulsehq/integrations), not duplicated in `embedded_elt_builder`.

## Dispatcher vs per-run workers (ECS / Kubernetes / Docker)

The **long-lived gateway** process should stay thin: poll the control plane, heartbeats, and **dispatch** work. Pipeline code (dlt/Sling, user scripts) and heavy monitor checks should run in a **separate one-shot process or container** so bad code or OOMs do not take down your poller.

**How we support that:**

1. **Manifest `executorHints`** (from a **named** gateway token’s JSON `metadata`): `pipelineRunIsolation` and `monitorCheckIsolation` are each `inline` (default) or `spawn`. Account-wide legacy tokens default to `inline`.
2. **Environment overrides** on the gateway host (win over manifest): `ELTPULSE_PIPELINE_RUN_ISOLATION`, `ELTPULSE_MONITOR_CHECK_ISOLATION`.
3. **Spawn targets** (reference implementation in `integrations/gateway`):
   - **`ELTPULSE_PIPELINE_RUN_SPAWN_COMMAND`** — shell command with `{{RUN_ID}}` and `{{CONTROL_PLANE_URL}}` (for example a script that calls `aws ecs run-task`, `kubectl create job`, or `docker run`).
   - **`ELTPULSE_PIPELINE_RUN_DOCKER_IMAGE`** — if set (and no shell command), runs `docker run` with **`ELTPULSE_SINGLE_RUN_ID`** so the same image enters **one-shot pipeline worker** mode (stub today; swap for your ELT entrypoint).
   - **`ELTPULSE_MONITOR_CHECK_SPAWN_COMMAND`** / **`ELTPULSE_MONITOR_CHECK_DOCKER_IMAGE`** — same pattern for monitors using **`ELTPULSE_SINGLE_MONITOR_ID`**.

**Inline mode** keeps the current behavior (execute in the gateway process) — useful for local Docker Compose or quick demos.

## Egress-only posture

- Gateway initiates TLS to the app URL (`NEXT_PUBLIC_APP_URL` / production host).
- Optional: allowlist URLs for warehouses and sources; **no** listener required on the gateway host for eltPulse.
- Tokens are created in the app (**Gateway** page); never commit secrets to Git.

## Relation to Dagster hybrid (conceptual)

- **Dagster+**: hybrid worker runs in your infra; control plane orchestrates; multiple backends (ECS, K8s, Docker, local).
- **eltPulse**: **gateway** runs in your infra; **same** HTTP contract everywhere; we standardize on **HTTPS egress + Bearer token** and document ECS/K8s/local as **deployment profiles** of one gateway.

## Repositories (github.com/eltpulsehq)

| Repo / artifact | Purpose |
|-----------------|--------|
| [`eltpulsehq/integrations`](https://github.com/eltpulsehq/integrations) | **Gateway** source (`gateway/`), **`ghcr.io/eltpulsehq/gateway:latest`** publish workflow, and **`gateways/`** (Docker, K8s, ECS, Terraform). |

The same tree lives under `integrations/` in this monorepo; publish from there to `eltpulsehq/integrations`.

## API surface (stable for all runtimes)

The gateway uses the same routes (Bearer = token from the app **Gateway** page):

- `GET /api/agent/manifest` (includes `executorHints` for named tokens: `pipelineRunIsolation`, `monitorCheckIsolation`)
- `GET /api/agent/runs`
- `GET /api/agent/connections`
- `POST /api/agent/heartbeat`
- `PATCH /api/agent/runs/:id`
- `POST /api/agent/monitors/:id/report` — after evaluating an S3/SQS monitor locally, the gateway posts `shouldTrigger` / `message` / `metadata`; the control plane updates `lastCheckAt` and may enqueue a pipeline run (same as cloud cron).

**Monitor placement** mirrors **pipeline** “Runs on”: `executionHost` on each monitor is `inherit` (follow `billing.executionPlane` on the manifest), `eltpulse_managed` (control plane cron only), or `customer_gateway` (gateway only). The reference gateway in `integrations/gateway` evaluates S3/SQS on that cadence when placement resolves to the customer side.

See the in-app **Gateway** page and [`eltpulsehq/integrations` → `gateway/`](https://github.com/eltpulsehq/integrations/tree/main/gateway) for implementation notes.

## Organization workspaces (Clerk org)

Named gateway tokens can be **org-scoped** (shared by the workspace) in addition to personal tokens. The org’s **default gateway** applies to unrouted runs when you are working in that org context (session), before falling back to your personal default. Creating org-scoped tokens is limited to **Pro** and **Team** on the **organization owner’s** subscription.

**Per-pipeline hybrid:** each pipeline can set **Runs on** to *inherit account*, *eltPulse-managed*, or *customer gateway*, so one workspace can run some pipelines on eltPulse-managed compute and others on org or personal gateways.

For **hosted** multi-tenant scale (cron, DB, future managed workers), see [Control plane scaling](./control-plane-scaling.md).
