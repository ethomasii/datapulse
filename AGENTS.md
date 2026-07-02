# DataPulse

Monorepo with two products:
- `embedded_elt_builder/` — Python `elt` CLI + FastAPI ELT Builder web UI (legacy/reference).
- `web/` — DataPulse (eltPulse) Next.js 14 SaaS: the modern product (Prisma/Postgres, Clerk, Stripe, Resend). See `web/README.md`.

## Cursor Cloud specific instructions

Dependencies (Python package, `web/` npm deps) are installed by the startup update script. Notes below are the non-obvious, durable bits.

### Postgres (required for `web/`)
- Postgres 16 is installed but the service is NOT auto-started. Start it each session:
  `sudo pg_ctlcluster 16 main start` (or `sudo service postgresql start`).
- A local dev database already exists: `postgresql://postgres:password@localhost:5432/eltpulse` (also created: `stackpulse`, `dispatch`). The default `web/.env.example` `DATABASE_URL`/`DIRECT_URL` already point at it.

### `web/` (Next.js — eltPulse)
- Setup: `cd web && cp .env.example .env.local`, then `npm run db:push` (schema → Postgres), then `PORT=3001 npm run dev` (port 3000 is used by servicepulse in this workspace).
- Auth: leave `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY` empty → middleware uses dev-passthrough and redirects protected routes to `/dev-setup`. Public/marketing pages render without Clerk. The authenticated app (`/builder`, `/dashboard`) requires REAL Clerk keys — there is no local login bypass.
- Lint: `npm run lint` (warnings only). Tests: `npm test` (vitest).

### Python package (`embedded_elt_builder/`)
- The `elt` console script (`~/.local/bin/elt`, ensure `~/.local/bin` is on PATH) currently fails to import due to a pre-existing bug: `SensorResult` is referenced but never defined in `embedded_elt_builder/sensors/__init__.py`. This is product code, unrelated to environment setup.
- The FastAPI ELT Builder web UI works. There is no `web/__main__.py`; launch it via the factory:
  `python3 -c "import uvicorn; from embedded_elt_builder.web import create_app; uvicorn.run(create_app('/tmp/elt-pipelines'), host='127.0.0.1', port=8000)"`
- Dependency pin: this code uses the legacy Starlette `TemplateResponse(name, context)` signature, so `fastapi==0.104.1` (Starlette 0.27) is pinned by the update script; newer FastAPI/Starlette breaks the `/` template render. A modern `jinja2>=3.1.6` (user site) is also pinned so the old system jinja2 isn't used.
- Create pipelines via the API (works reliably), e.g. `POST /api/pipelines` with `{"name","source_type","destination_type"}`. The UI "New Pipeline" destination dropdown is broken by a pre-existing duplicate `/api/destinations` route (one returns types, shadowing the one returning configured instances).
