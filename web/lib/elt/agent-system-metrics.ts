/**
 * Optional worker CPU/RAM sampling for run telemetry (`telemetrySummary.system`).
 * Works in Node gateways and managed executors without extra deps.
 *
 * Enable: ELTPULSE_SYSTEM_METRICS=1 (default on). Disable: ELTPULSE_SYSTEM_METRICS=0
 */

export type SystemMetrics = {
  cpuPercent?: number;
  memoryMb?: number;
};

export function systemMetricsEnabled(): boolean {
  const raw = process.env.ELTPULSE_SYSTEM_METRICS?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return true;
}

export function systemMetricsIntervalMs(): number {
  const n = Number(process.env.ELTPULSE_SYSTEM_METRICS_INTERVAL_MS ?? "");
  if (Number.isFinite(n) && n >= 5_000) return Math.min(n, 120_000);
  return 20_000;
}

let lastCpuUsage: NodeJS.CpuUsage | null = null;
let lastCpuAt = 0;

/** Best-effort process metrics for the current Node worker (no native addons). */
export function readProcessSystemMetrics(): SystemMetrics | null {
  const mem = process.memoryUsage();
  const memoryMb = Math.round((mem.rss / (1024 * 1024)) * 10) / 10;

  const now = Date.now();
  let cpuPercent: number | undefined;
  const usage = process.cpuUsage();
  if (lastCpuUsage && lastCpuAt > 0) {
    const elapsedMs = now - lastCpuAt;
    if (elapsedMs > 0) {
      const userDelta = usage.user - lastCpuUsage.user;
      const sysDelta = usage.system - lastCpuUsage.system;
      const cpuMs = (userDelta + sysDelta) / 1000;
      cpuPercent = Math.min(100, Math.round((cpuMs / elapsedMs) * 1000) / 10);
    }
  }
  lastCpuUsage = usage;
  lastCpuAt = now;

  return {
    memoryMb,
    ...(cpuPercent !== undefined ? { cpuPercent } : {}),
  };
}

export function telemetryPatchWithSystem(metrics: SystemMetrics | null): {
  telemetrySummary?: { system: SystemMetrics };
  appendTelemetrySample?: { system: SystemMetrics };
} {
  if (!metrics) return {};
  return {
    telemetrySummary: { system: metrics },
    appendTelemetrySample: { system: metrics },
  };
}

/** Poll until `stop()` is called; invokes `patch` with telemetry fragments. */
export function startSystemMetricsSampler(patch: (body: Record<string, unknown>) => Promise<void>): {
  stop: () => void;
} {
  if (!systemMetricsEnabled()) {
    return { stop: () => undefined };
  }

  let stopped = false;
  const intervalMs = systemMetricsIntervalMs();

  const tick = async () => {
    if (stopped) return;
    const system = readProcessSystemMetrics();
    if (!system) return;
    try {
      await patch({
        status: "running",
        ...telemetryPatchWithSystem(system),
      });
    } catch {
      /* non-fatal */
    }
  };

  void tick();
  const handle = setInterval(() => void tick(), intervalMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(handle);
    },
  };
}
