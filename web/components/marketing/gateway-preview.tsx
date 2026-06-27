import { Activity, Cloud, Server } from "lucide-react";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

export function GatewayPreview() {
  return (
    <MarketingFrame title="eltpulse.dev — Execution">
      <div className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border-2 border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900 dark:bg-sky-950/20">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-sky-600" aria-hidden />
              <p className="text-[11px] font-bold text-slate-900 dark:text-white">eltPulse-managed</p>
            </div>
            <p className="mt-2 text-[9px] leading-snug text-slate-600 dark:text-slate-400">
              Default — no VPC setup. Workers poll runs and report telemetry.
            </p>
            <span className="mt-2 inline-block rounded-full bg-sky-600 px-2 py-0.5 text-[8px] font-semibold text-white">
              Active
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-500" aria-hidden />
              <p className="text-[11px] font-bold text-slate-900 dark:text-white">Customer gateway</p>
            </div>
            <p className="mt-2 text-[9px] leading-snug text-slate-600 dark:text-slate-400">
              ECS · K8s · Docker in your VPC. Egress-only HTTPS to control plane.
            </p>
            <div className="mt-2 flex items-center gap-1 text-[9px] text-slate-500">
              <Activity className="h-3 w-3" aria-hidden />
              prod-gateway · connected
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[9px] text-slate-500">Per-pipeline &quot;Runs on&quot; overrides inherit or pin either plane.</p>
      </div>
    </MarketingFrame>
  );
}
