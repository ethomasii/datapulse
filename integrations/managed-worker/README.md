# eltPulse managed worker (reference)

Processes **`eltpulse_managed`** pipeline runs via the **internal** control-plane APIs (same bearer secret as `POST /api/internal/agent-heartbeat`).

## Cost-friendly execution (no always-on VM)

1. **Vercel Cron (default in `web/vercel.json`)** — `GET /api/cron/managed-worker` every 15 minutes. Each invocation is a **short burst**: it self-calls `GET/PATCH /api/internal/managed-runs*` using `ELTPULSE_INTERNAL_API_SECRET`. Idle cost ≈ **zero** compute; you pay per cron tick + function duration.

   - Set **`CRON_SECRET`** (Vercel injects `Authorization: Bearer …` on cron).
   - Set **`ELTPULSE_INTERNAL_API_SECRET`** (must match internal routes).
   - Set **`ELTPULSE_CRON_APP_URL`** to your production HTTPS origin if `VERCEL_URL` / `NEXT_PUBLIC_APP_URL` is not enough (e.g. custom domain).

   **Executor mode** — `ELTPULSE_MANAGED_EXECUTOR`:

   | Value | Behavior |
   |-------|----------|
   | `stub` (default) | Marks runs succeeded with demo telemetry (no dlt/Sling). |
   | `local` | Runs **real** `python pipeline.py [partition]` or `sling run -r replication.yaml` **in the same Node process host** as the cron handler (requires Python/dlt and/or Sling on that machine). **Stock Vercel serverless usually does not have these** — use `stub` on Vercel, or run the CLI below on a VM / laptop / job runner. |

2. **External scheduler** — AWS EventBridge, Cloud Scheduler, GitHub Actions cron: `curl` your deployed `/api/cron/managed-worker` with `Authorization: Bearer $CRON_SECRET` on whatever cadence you want (cheaper than 15m if load is low).

3. **CLI (recommended for real loads on your laptop or build agent)** — from the `web/` app (loads `.env.local`):

   ```bash
   cd web
   pnpm install
   # .env.local: ELTPULSE_INTERNAL_API_SECRET, ELTPULSE_MANAGED_EXECUTOR=local,
   #             NEXT_PUBLIC_APP_URL or ELTPULSE_CONTROL_PLANE_URL
   pnpm managed-worker:local
   ```

   Optional env:

   - `ELTPULSE_MANAGED_PYTHON_BIN` — default `python3` (macOS/Linux) or `python` (Windows).
   - `ELTPULSE_MANAGED_SLING_BIN` — default `sling`.
   - `ELTPULSE_MANAGED_RUN_TIMEOUT_MS` — default 45 minutes.
   - `ELTPULSE_MANAGED_LIMIT` — max runs per invocation (default 5).
   - `ELTPULSE_MANAGED_DEADLINE_MS` — wall-clock cap for the CLI (default 1 hour).

4. **Legacy one-shot (stub only)** — `integrations/managed-worker/run-once.mjs` still performs **stub** completion. For real execution use `pnpm managed-worker:local` with `ELTPULSE_MANAGED_EXECUTOR=local`.

## Internal APIs (managed worker)

- `GET /api/internal/managed-runs?limit=N` — pending managed runs + pipeline manifest fields.
- `PATCH /api/internal/managed-runs/:id` — claim (`pending` → `running`) and report logs / telemetry / terminal status.
- `GET /api/internal/managed-runs/:id` — read `status` (e.g. cancel wiring later).
- `GET /api/internal/managed-runs/:id/executor-context` — **after claim**, returns pipeline artifacts + **decrypted** connection secrets for source/destination `Connection` rows (internal bearer only).

## Tuning cron frequency

- More frequent cron → lower **latency** to pick up pending runs, more **invocations** (Vercel billing).
- Less frequent → fewer invocations, higher worst-case delay.
- Edit `web/vercel.json` → `schedule` for `/api/cron/managed-worker`.

Customer gateways **must not** poll managed runs; `GET /api/agent/runs` excludes `eltpulse_managed` / `datapulse_managed`.
