# eltPulse gateway runtimes (Dagster+–style)

This document describes how we want **self-hosted execution** to feel for customers: similar in spirit to [Dagster+ hybrid agents](https://docs.dagster.io/deployment/dagster-plus/hybrid) (ECS, Kubernetes, Docker/local), but with **egress-only** connectivity to the eltPulse control plane.

**Canonical code and deployment assets** live under the [eltpulsehq](https://github.com/eltpulsehq) GitHub organization (not this repo). This file is the product map and link hub.

## Control plane vs agent

| Piece | Role |
|--------|------|
| **eltPulse app** (this repo / Vercel) | Auth, pipelines, runs, secrets references, webhooks, **no** inbound connections to customer networks. |
| **Gateway agent** (eltpulsehq) | Long-lived process in **your** VPC/cluster/laptop: **outbound HTTPS** to `GET /api/agent/*`, polls pending runs, pulls connection secrets, executes ingestion, reports heartbeats and run status. |

No inbound firewall rules are required for the control plane to reach the agent. The agent only **egresses** to eltPulse (and to data sources/warehouses you configure).

## Runtime matrix (target shape)

Same **agent binary / image** and **Bearer token**; different **where** you run it:

| Runtime | When to use | How we document it (eltpulsehq) |
|---------|-------------|----------------------------------|
| **ECS agent** | AWS, Fargate or EC2-backed tasks, IAM-scoped | Task definition, service, secrets, egress SG to eltPulse + data plane. |
| **Kubernetes agent** | K8s clusters, Helm/GitOps | Deployment, `ELTPULSE_*` env, optional NetworkPolicy egress-only. |
| **Local agent** | Dev laptops, air-gapped jump hosts, CI | Docker or bare metal; same env vars as today’s `ghcr.io/eltpulsehq/agent`. |

Each runtime is **documentation + example manifests** in eltpulsehq repos (e.g. `agent`, future `agent-chart`, `agent-ecs`), not duplicated in `embedded_elt_builder`.

## Egress-only posture

- Agent initiates TLS to the app URL (`NEXT_PUBLIC_APP_URL` / production host).
- Optional: allowlist URLs for warehouses and sources; **no** listener required on the agent host for eltPulse.
- Tokens are created in the app (**Gateway** page); never commit secrets to Git.

## Relation to Dagster hybrid (conceptual)

- **Dagster+**: hybrid agent runs in your infra; control plane orchestrates; multiple agent backends (ECS, K8s, Docker, local).
- **eltPulse**: gateway agent runs in your infra; **same** API contract everywhere; we standardize on **HTTPS egress + Bearer token** and document ECS/K8s/local as **deployment profiles** of one agent.

## Repositories (github.com/eltpulsehq)

| Repo / artifact | Purpose |
|-----------------|--------|
| [`eltpulsehq/agent`](https://github.com/eltpulsehq/agent) | Reference gateway implementation and container image (`ghcr.io/eltpulsehq/agent`). |
| *Future* `agent-chart` | Helm chart for Kubernetes. |
| *Future* `agent-ecs` | ECS task/service samples, Terraform/CDK snippets. |

Links and status should stay current in the eltpulsehq org READMEs; this document only tracks the **intended** split.

## API surface (stable for all runtimes)

All agents use the same routes (Bearer = gateway token from the app):

- `GET /api/agent/manifest`
- `GET /api/agent/runs`
- `GET /api/agent/connections`
- `POST /api/agent/heartbeat`
- `PATCH /api/agent/runs/:id`

See the in-app **Gateway** page and OpenAPI-style notes in agent source for details.

## Organization workspaces (Clerk org)

Named gateway tokens can be **org-scoped** (shared by the workspace) in addition to personal tokens. The org’s **default gateway** applies to unrouted runs when you are working in that org context (session), before falling back to your personal default. Creating org-scoped tokens is limited to **Pro** and **Team** on the **organization owner’s** subscription.

**Per-pipeline hybrid:** each pipeline can set **Runs on** to *inherit account*, *eltPulse-managed*, or *customer gateway*, so one workspace can run some pipelines on eltPulse-managed compute and others on org or personal gateways.
