# eltPulse product backlog

Tracked gaps and enhancements identified during pricing, tier-gating, and enterprise/BYOC work.

## Shipped recently

- [x] ServicePulse-style pricing page + annual billing
- [x] Dedicated managed compute billing (Team add-on)
- [x] Tier gates: pipelines, API keys, webhooks, Git export, column lineage, run history, org invites
- [x] BYOC on all tiers with personal gateway limits (1 / 5 / unlimited)
- [x] Enterprise list floor: **$2,400/mo · $24,000/yr** (self-hosted control plane)
- [x] Air-gap metadata export v1 (org webhook mirror on terminal runs)
- [x] **Air-gap v2** — redact cloud `logEntries` / verbose telemetry after successful export
- [x] **Team+ entitlement** — air-gap and SSO included by plan tier (no `ELTPULSE_AIRGAP_*` env flags)
- [x] **SSO wiring** — Security UI + `/api/account/sso` + Clerk Dashboard setup docs

- [x] **Team under Account & Settings** — `/account/team`, tier-gated invites, redirects from `/team`
- [x] **Integrations under Account** — `/account/integrations`, redirect from `/integrations`
- [x] **Audit log v1** — workspace events for org, invites, API keys + CSV export

## In progress

- [ ] **Enterprise Stripe / invoicing** — optional self-serve annual invoice for Enterprise floor (currently sales-assisted)
- [ ] **Usage meter production** — `STRIPE_USAGE_METER_EVENT_NAME` + included row baselines per tier
- [ ] **Real managed worker fleet** — replace in-process stub with `workers.eltpulse.dev` at scale
- [ ] **Clerk SAML hands-on** — ops runbook for configuring customer IdPs in Clerk (Okta, Entra, Google)

## Air-gap v3+

- [ ] S3/GCS push destination (not just HTTPS webhook)
- [ ] Batch re-export / backfill for compliance audits
- [ ] Rotate signing secrets UX for air-gap webhook

## Enterprise & self-hosted

- [ ] Self-hosted control plane Docker compose + Helm chart (sales kit)
- [ ] License key validation in self-hosted image (annual contract enforcement)
- [ ] Air-gapped **control plane** (no outbound to eltpulse.dev except optional telemetry opt-in)
- [ ] Enterprise tier in Prisma / admin flag (today: `ELTPULSE_ENTERPRISE_ORG_IDS`)

## Billing & pricing

- [ ] Pro/Team **included row volume** numbers on pricing page (currently “Included” / “Custom”)
- [ ] 14-day trial Stripe configuration (checkout + webhook trialing state)
- [ ] Downgrade behavior: revoke webhooks / excess gateways on tier drop
- [ ] Dedicated compute usage meter → Stripe (infra cost-plus 15%)

## Product & UX

- [x] Run detail: air-gap export status badge
- [ ] Team page: surface gateway limit + upgrade CTA when at cap
- [ ] Gateway page: show `personalGatewayLimit` from `/api/elt/agent-status`
- [ ] OpenAPI reference for public API (roadmap item)
- [ ] **Audit log v2** — pipeline CRUD, billing changes, sign-in events, immutable retention policy
- [ ] Managed Git commits (in progress on roadmap)

## Security & compliance

- [ ] SOC2 / security questionnaire one-pager for Enterprise sales
- [x] Document air-gap payload schema in `/docs/security`

## Ops

- [ ] Run `prisma migrate deploy` on production after each migration push
- [ ] Optional: set `CLERK_ENTERPRISE_CONNECTION_ID` so Security UI shows IdP configured
- [ ] Ops kill-switch only: `ELTPULSE_AIRGAP_DISABLED=true` to disable air-gap globally in emergency
