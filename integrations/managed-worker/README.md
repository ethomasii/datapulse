# eltPulse managed worker (reference)

Processes **`eltpulse_managed`** pipeline runs via the **internal** control-plane APIs (same bearer secret as `POST /api/internal/agent-heartbeat`).

## Cost-friendly execution (no always-on VM)

1. **Vercel Cron (default in `web/vercel.json`)** — `GET /api/cron/managed-worker` every 15 minutes. Each invocation is a **short burst** (stub: self-calls internal APIs; **vercel-python**: forwards to the Python service). Idle cost ≈ **zero** when nothing runs; you pay per cron tick + function duration.

   - Set **`CRON_SECRET`** (Vercel injects `Authorization: Bearer …` on cron).
   - Set **`ELTPULSE_INTERNAL_API_SECRET`** (must match internal routes).
   - Set **`ELTPULSE_CRON_APP_URL`** to your production HTTPS origin if `VERCEL_URL` / `NEXT_PUBLIC_APP_URL` is not enough (e.g. custom domain).

   **Executor mode** — `ELTPULSE_MANAGED_EXECUTOR`:

   | Value | Behavior |
   |-------|----------|
   | `stub` (default) | Marks runs succeeded with demo telemetry (no dlt/Sling). |
   | `local` | Runs **real** `python pipeline.py [partition]` or `sling run -r replication.yaml` **in the same Node process host** as the cron handler (dev VM / container with Python + dlt/Sling). |
   | `vercel-python` | **Vercel [Services](https://vercel.com/docs/services)** — Next.js at `/`, FastAPI worker at **`/managed-elt`**. Cron `POST`s ` /managed-elt/batch` (Bearer `ELTPULSE_MANAGED_VERCEL_PYTHON_SECRET`). Python runs **real** subprocess dlt/Sling with **`maxDuration: 900`** ( **900 seconds = 15 minutes** ) per Python invocation for the **whole batch**. |

   **`vercel-python` env (Vercel project — shared by both services):**

   - `ELTPULSE_MANAGED_VERCEL_PYTHON_SECRET` — long random string; cron sends `Authorization: Bearer …` to `/managed-elt/batch`.
   - `ELTPULSE_INTERNAL_API_SECRET` — Python uses this to PATCH/GET internal APIs on the same deployment.
   - Optional: `ELTPULSE_MANAGED_VERCEL_PYTHON_PATH` — default `/managed-elt` if you change the route prefix in `vercel.json`.

   **15-minute cap (product stance for now):** one serverless invocation cannot exceed Vercel’s configured `maxDuration` (here **900s**). Multiple pending runs in one tick **share** that wall clock; use a low `limit` (e.g. `1`) for heavy pipelines. Customers who need **longer** runs should move to **option #2** (separate long-runner / queue / second deployment) or a future queue+chunking design — not “more expensive” by magic, but **operationally** you maintain two deployables or a job system, and you pay for **two** cold starts / billing surfaces if you split projects.

   **Deploy requirement:** the Vercel project must use **Services** (polyglot) so `experimentalServices` in `web/vercel.json` is honored. If you are not ready for Services, remove the `experimentalServices` block from `vercel.json` and keep `ELTPULSE_MANAGED_EXECUTOR=stub` or use **`local`** / the CLI on a VM.

2. **External scheduler** — AWS EventBridge, Cloud Scheduler, GitHub Actions cron: `curl` your deployed `/api/cron/managed-worker` with `Authorization: Bearer $CRON_SECRET` on whatever cadence you want (cheaper than 15m if load is low).

3. **CLI (laptop / build agent)** — from `web/`:

   ```bash
   cd web
   npm install
   # .env.local: ELTPULSE_INTERNAL_API_SECRET, ELTPULSE_MANAGED_EXECUTOR=local,
   #             NEXT_PUBLIC_APP_URL or ELTPULSE_CONTROL_PLANE_URL
   npm run managed-worker:local
   ```

   Optional env: `ELTPULSE_MANAGED_PYTHON_BIN`, `ELTPULSE_MANAGED_SLING_BIN`, `ELTPULSE_MANAGED_RUN_TIMEOUT_MS`, `ELTPULSE_MANAGED_LIMIT`, `ELTPULSE_MANAGED_DEADLINE_MS`.

4. **Legacy one-shot (stub only)** — `integrations/managed-worker/run-once.mjs` is still **stub** only. For real execution use `npm run managed-worker:local` or `vercel-python` on Vercel.

## Internal APIs (managed worker)

- `GET /api/internal/managed-runs?limit=N` — pending managed runs + pipeline manifest fields.
- `PATCH /api/internal/managed-runs/:id` — claim (`pending` → `running`) and report logs / telemetry / terminal status.
- `GET /api/internal/managed-runs/:id` — read `status`.
- `GET /api/internal/managed-runs/:id/executor-context` — **after claim**, pipeline artifacts + **decrypted** connection secrets (internal bearer only).

## Python worker (FastAPI)

- Source: `web/managed-worker-service/main.py` + `pyproject.toml`.
- **Sling** on stock Vercel Python images usually **has no `sling` binary**; those runs fail with a clear error unless you add a layer/binary. **dlt** pipelines use `sys.executable` and the service’s installed `dlt` package.

## Tuning cron frequency

- More frequent cron → lower **latency** to pick up pending runs, more **invocations** (Vercel billing).
- Less frequent → fewer invocations, higher worst-case delay.
- Edit `web/vercel.json` → `schedule` for `/api/cron/managed-worker`.

Customer gateways **must not** poll managed runs; `GET /api/agent/runs` excludes `eltpulse_managed` / `datapulse_managed`.
