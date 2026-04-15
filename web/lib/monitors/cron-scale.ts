/**
 * Optional scaling controls for `GET /api/cron/monitors` (multi-tenant eltPulse-managed checks).
 *
 * Sharding: run the same route N times with different `shard` / `shards` (or env) so each invocation
 * evaluates a disjoint subset of monitors — horizontal scale without one Lambda exceeding time limits.
 *
 * Wall-clock budget: stop early and let the next cron tick continue (monitors not touched keep prior lastCheckAt).
 */

export type CronMonitorScaleOptions = {
  shardIndex: number;
  shardCount: number;
  /** When set, stop processing after this many milliseconds (leave headroom below `maxDuration`). */
  maxElapsedMs?: number;
};

/** Deterministic bucket in `[0, shardCount)` for stable routing across invocations. */
export function stableMonitorShard(userId: string, monitorId: string, shardCount: number): number {
  if (shardCount <= 1) return 0;
  const s = `${userId}:${monitorId}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % shardCount;
}

function clampInt(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/**
 * URL query wins; then env. Invalid combinations fall back to a single shard.
 * Query: `?shard=0&shards=4` and optional `budgetMs=90000`.
 * Env: `CRON_MONITOR_SHARD_INDEX`, `CRON_MONITOR_SHARD_COUNT`, `CRON_MONITOR_MAX_MS`.
 */
export function resolveCronMonitorScale(
  requestUrl: string,
  env: Record<string, string | undefined> = process.env
): CronMonitorScaleOptions {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return { shardIndex: 0, shardCount: 1, maxElapsedMs: parseBudgetMs(env) };
  }

  const fromQueryShards = url.searchParams.get("shards");
  const fromQueryShard = url.searchParams.get("shard");
  const fromQueryBudget = url.searchParams.get("budgetMs");

  const shardCount = clampInt(
    parseInt(fromQueryShards ?? env.CRON_MONITOR_SHARD_COUNT ?? "1", 10),
    1,
    64,
    1
  );
  const shardIndex = clampInt(
    parseInt(fromQueryShard ?? env.CRON_MONITOR_SHARD_INDEX ?? "0", 10),
    0,
    Math.max(0, shardCount - 1),
    0
  );

  const budgetFromQuery = fromQueryBudget != null ? parseInt(fromQueryBudget, 10) : NaN;
  const maxElapsedMs =
    Number.isFinite(budgetFromQuery) && budgetFromQuery > 1000
      ? Math.min(300_000, budgetFromQuery)
      : parseBudgetMs(env);

  return { shardIndex, shardCount, maxElapsedMs };
}

function parseBudgetMs(env: Record<string, string | undefined>): number | undefined {
  const raw = env.CRON_MONITOR_MAX_MS;
  if (raw == null || raw === "") return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 5000) return undefined;
  return Math.min(300_000, n);
}
