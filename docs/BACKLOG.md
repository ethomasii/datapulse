# eltPulse product backlog

Tracked gaps and enhancements identified during pricing, tier-gating, and enterprise/BYOC work.

## Shipped recently

- [x] ServicePulse-style pricing page + annual billing
- [x] Dedicated managed compute billing (Team add-on)
- [x] Tier gates: pipelines, API keys, webhooks, Git export, column lineage, run history, org invites
- [x] BYOC on all tiers with personal gateway limits (1 / 5 / unlimited)
- [x] Enterprise list floor: **$2,400/mo · $24,000/yr** (self-hosted control plane)
- [x] Air-gap metadata export v1 (org webhook mirror on terminal runs)

## In progress

- [ ] **Clerk SAML / SSO** — wire `ELTPULSE_SSO_ENABLED`, Team+ gate, IdP config docs
- [ ] **Enterprise Stripe / invoicing** — optional self-serve annual invoice for Enterprise floor (currently sales-assisted)
- [ ] **Usage meter production** — `STRIPE_USAGE_METER_EVENT_NAME` + included row baselines per tier
- [ ] **Real managed worker fleet** — replace in-process stub with `workers.eltpulse.dev` at scale

## Air-gap v2+ (after v1 webhook mirror)

- [ ] Stop persisting full `logEntries` in Neon when `customer_export` mode (customer vault only)
- [ ] S3/GCS push destination (not just HTTPS webhook)
- [ ] Batch re-export / backfill for compliance audits
- [ ] UI indicator on run detail: “metadata mirrored to your vault”

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

- [ ] Team page: surface gateway limit + upgrade CTA when at cap
- [ ] Gateway page: show `personalGatewayLimit` from `/api/elt/agent-status`
- [ ] OpenAPI reference for public API (roadmap item)
- [ ] Audit log backend (page exists, data not wired)
- [ ] Managed Git commits (in progress on roadmap)

## Security & compliance

- [ ] SOC2 / security questionnaire one-pager for Enterprise sales
- [ ] Rotate signing secrets UX for air-gap webhook
- [ ] Document air-gap payload schema (`schemaVersion: 1`) in `/docs/security`

## Ops

- [ ] Run `prisma migrate deploy` on production after each migration push
- [ ] Vercel env: set `ELTPULSE_AIRGAP_METADATA_ENABLED=true` when ready for Team preview customers
