# eltPulse managed worker (reference)

Processes **`eltpulse_managed`** pipeline runs via the **internal** control-plane APIs (same bearer secret as `POST /api/internal/agent-heartbeat`).

## Cost-friendly execution (no always-on VM)

1. **Vercel Cron (default in `web/vercel.json`)** — `GET /api/cron/managed-worker` every 15 minutes. Each invocation is a **short burst**: it self-calls `GET/PATCH /api/internal/managed-runs*` using `ELTPULSE_INTERNAL_API_SECRET`. Idle cost ≈ **zero** compute; you pay per cron tick + function duration.

   - Set **`CRON_SECRET`** (Vercel injects `Authorization: Bearer …` on cron).
   - Set **`ELTPULSE_INTERNAL_API_SECRET`** (must match internal routes).
   - Set **`ELTPULSE_CRON_APP_URL`** to your production HTTPS origin if `VERCEL_URL` / `NEXT_PUBLIC_APP_URL` is not enough (e.g. custom domain).

   **Current behavior:** **stub** completion (fake telemetry), same class as the gateway demo — proves wiring. Replace `stubCompleteManagedRunHttp` in `web/lib/elt/managed-worker-stub-http.ts` with real execution (spawn container, call Modal/Fly/K8s Job, then PATCH real telemetry).

2. **External scheduler** — AWS EventBridge, Cloud Scheduler, GitHub Actions cron: `curl` your deployed `/api/cron/managed-worker` with `Authorization: Bearer $CRON_SECRET` on whatever cadence you want (cheaper than 15m if load is low).

3. **One-shot script (VM / laptop)** when you do not use Vercel cron:

   ```bash
   cd integrations/managed-worker
   export ELTPULSE_CONTROL_PLANE_URL="https://your-deployment.example"
   export ELTPULSE_INTERNAL_API_SECRET="…"
   node run-once.mjs
   ```

## Tuning cron frequency

- More frequent cron → lower **latency** to pick up pending runs, more **invocations** (Vercel billing).
- Less frequent → fewer invocations, higher worst-case delay.
- Edit `web/vercel.json` → `schedule` for `/api/cron/managed-worker`.

## Real pipelines (next step)

Stub is intentional for a thin control plane. A real worker should:

1. `GET /api/internal/managed-runs?limit=N`
2. For each run: load `pipeline.pipelineCode`, secrets (extend internal API or fetch per-user connections with service credentials), run **dlt** in an isolated environment
3. `PATCH /api/internal/managed-runs/:id` with live logs/telemetry, then terminal status

Customer gateways **must not** poll managed runs; `GET /api/agent/runs` excludes `eltpulse_managed` / `datapulse_managed`.
