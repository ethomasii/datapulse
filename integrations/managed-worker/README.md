# eltPulse managed worker (reference)

Processes **`eltpulse_managed`** pipeline runs via the **internal** control-plane APIs (same bearer secret as `POST /api/internal/agent-heartbeat`).

---

## Vercel Services (same project — `vercel-python`)

Vercel’s message is **two parts**:

1. **Project setting (dashboard)** — In the Vercel project, the **framework / project type** must be set to **Services** (polyglot). If the project is still “Next.js only,” the build will not wire `experimentalServices` the way you expect.
2. **Repo config** — `web/vercel.json` must contain **`experimentalServices`** (we ship `web` + `api` keys to match the [quick start](https://vercel.com/docs/services)).

**Monorepo:** set the Vercel **Root Directory** to **`web`** so `vercel.json`, `app/`, and `managed-worker-service/` all resolve from the same root.

**Local:** `vercel dev -L` runs all services together.

---

## Two pending runs + `limit=1` — do they each get 15 minutes?

**No — they do not run in parallel** from this design, and **they do not each get their own 15‑minute serverless budget** unless you trigger **two separate** invocations (e.g. two cron hits or two workers).

- **`limit=1` on one `/batch` call:** at most **one** run is taken from the queue for that invocation. That run may use up to **~900 seconds** for that **single** Python/Node invocation (minus startup/overhead).
- **A second pending run:** waits until the **next** time work runs — e.g. the **next cron** tick (`*/15 * * * *` → up to ~15 minutes later), or another manual `GET /api/cron/managed-worker`, or a second concurrent worker if you add that later.
- **`limit=2` in one `/batch`:** runs are processed **one after another** in a **for** loop. **Both share one 900s wall clock** for that invocation. So run #2 does **not** get a fresh 15 minutes; if run #1 takes 14 minutes, run #2 only has ~1 minute left before the function is cut off.

**Summary:** `limit=1` = **time-queue between ticks** (and at most one heavy run per invocation). It is **not** “15 minutes per run” in parallel unless you run **multiple invocations** in parallel (separate design).

---

## Environment variables

### Always (any executor on Vercel)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` / `DIRECT_URL` | Postgres (Neon, etc.) |
| `ELTPULSE_TOKEN_ENCRYPTION_KEY` | Decrypt connection secrets for `executor-context` |
| `ELTPULSE_INTERNAL_API_SECRET` | Bearer for `/api/internal/*` (managed runs, heartbeat) |
| `CRON_SECRET` | Cron `Authorization: Bearer …` for `/api/cron/*` |
| `NEXT_PUBLIC_APP_URL` | Public app URL (or rely on `VERCEL_URL` in prod) |
| `ELTPULSE_CRON_APP_URL` | Optional; canonical HTTPS origin for server-to-server calls (custom domain) |

### `ELTPULSE_MANAGED_EXECUTOR=stub` (default)

No extra managed vars. Cron self-calls internal APIs with `ELTPULSE_INTERNAL_API_SECRET`.

### `ELTPULSE_MANAGED_EXECUTOR=vercel-python` (Services — same deployment)

| Variable | Purpose |
|----------|---------|
| `ELTPULSE_MANAGED_VERCEL_PYTHON_SECRET` | Cron → `POST /managed-elt/batch` with `Authorization: Bearer …` |
| `ELTPULSE_MANAGED_VERCEL_PYTHON_PATH` | Optional; default `/managed-elt` if you change `routePrefix` |
| `ELTPULSE_MANAGED_RUN_TIMEOUT_MS` | Optional; per-pipeline subprocess kill delay (ms), capped at 900_000 |

Python service uses the **same** `ELTPULSE_INTERNAL_API_SECRET` and `VERCEL_URL` / `ELTPULSE_CRON_APP_URL` / `NEXT_PUBLIC_APP_URL` to call the Next app’s internal routes.

### `ELTPULSE_MANAGED_EXECUTOR=delegate` (option #2 — second deployment / long-runner)

**Project A (Next — control plane + cron)**

| Variable | Purpose |
|----------|---------|
| `ELTPULSE_MANAGED_EXECUTOR` | `delegate` |
| `ELTPULSE_MANAGED_DELEGATE_URL` | Full URL to worker’s batch endpoint, e.g. `https://your-worker.vercel.app/managed-elt/batch` |
| `ELTPULSE_MANAGED_DELEGATE_SECRET` | Bearer secret; must match what the worker expects (`ELTPULSE_MANAGED_VERCEL_PYTHON_SECRET` on the worker) |

**Project B (Python worker only)** — deploy `managed-worker-service/` (same FastAPI app). It does **not** need the Next app; it only needs HTTP access to **Project A’s origin**.

| Variable | Purpose |
|----------|---------|
| `ELTPULSE_CONTROL_PLANE_URL` | **Project A** HTTPS origin, e.g. `https://app.yourdomain.com` |
| `ELTPULSE_INTERNAL_API_SECRET` | **Same value as Project A** (so internal APIs authorize) |
| `ELTPULSE_MANAGED_VERCEL_PYTHON_SECRET` | **Same value as** `ELTPULSE_MANAGED_DELEGATE_SECRET` on A (validates `POST /batch`) |
| `ELTPULSE_TOKEN_ENCRYPTION_KEY` | **Not required on B** if B only calls A’s HTTP APIs (A decrypts). Omit on B unless you add DB access there. |

Project B can use a **longer** `maxDuration` (or a non-Vercel host) if you move off the 900s cap.

If Project A uses **only** `delegate`, you may remove **`experimentalServices`** from Project A’s `vercel.json` (Next-only app) and deploy the Python worker **only** on Project B.

### `ELTPULSE_MANAGED_EXECUTOR=local` (CLI / Node on a VM)

See `npm run managed-worker:local` in `web/package.json` and `.env.local`: `ELTPULSE_MANAGED_EXECUTOR=local`, `ELTPULSE_INTERNAL_API_SECRET`, app URL.

---

## Cost-friendly execution (summary)

1. **Vercel Cron** — `GET /api/cron/managed-worker` (see `web/vercel.json`). Uses `ELTPULSE_MANAGED_EXECUTOR` to choose stub, same-host local, `vercel-python`, or `delegate`.

2. **External scheduler** — `curl` the same cron path with `Authorization: Bearer $CRON_SECRET`.

3. **CLI** — `cd web && npm run managed-worker:local` with `ELTPULSE_MANAGED_EXECUTOR=local`.

4. **Legacy stub** — `integrations/managed-worker/run-once.mjs`.

---

## Internal APIs

- `GET /api/internal/managed-runs?limit=N`
- `PATCH /api/internal/managed-runs/:id`
- `GET /api/internal/managed-runs/:id`
- `GET /api/internal/managed-runs/:id/executor-context` (after claim; decrypted connection secrets)

## Python worker

- `web/managed-worker-service/main.py` + `pyproject.toml`
- **Sling:** needs `sling` on `PATH` on that image; stock Vercel Python usually lacks it.
- **dlt:** uses `sys.executable` + installed `dlt`.

## Cron frequency

Edit `web/vercel.json` → `crons` → `/api/cron/managed-worker`.

Customer gateways **must not** poll managed runs; `GET /api/agent/runs` excludes `eltpulse_managed` / `datapulse_managed`.
