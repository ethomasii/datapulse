/**
 * Periodic evaluation of data contract freshness SLAs and contract expiry reminders.
 */

import { db } from "@/lib/db/client";
import { emitContractSlaEvent } from "@/lib/notifications/emit";

const REMINDER_DAYS = [60, 30, 14] as const;
const AT_RISK_RATIO = 0.8;

export type DataContractSlaCronResult = {
  contractsChecked: number;
  expiryDispatched: number;
  slaTransitions: number;
  errors: string[];
};

type SlaHealth = "ok" | "at_risk" | "breached";

function freshnessHealth(
  lastRunFinishedAt: Date | null,
  freshnessSlaHours: number
): SlaHealth {
  if (!lastRunFinishedAt) return "breached";
  const ageMs = Date.now() - lastRunFinishedAt.getTime();
  const slaMs = freshnessSlaHours * 60 * 60 * 1000;
  if (ageMs >= slaMs) return "breached";
  if (ageMs >= slaMs * AT_RISK_RATIO) return "at_risk";
  return "ok";
}

export async function evaluateDataContractSlaAndExpiry(): Promise<DataContractSlaCronResult> {
  const result: DataContractSlaCronResult = {
    contractsChecked: 0,
    expiryDispatched: 0,
    slaTransitions: 0,
    errors: [],
  };

  const now = new Date();
  const contracts = await db.dataContract.findMany({
    where: { status: "active" },
    include: { assets: { select: { assetKey: true } } },
  });

  for (const contract of contracts) {
    result.contractsChecked += 1;
    try {
      if (contract.expiresAt) {
        const msUntilExpiry = contract.expiresAt.getTime() - now.getTime();
        const daysUntilExpiry = msUntilExpiry / (24 * 60 * 60 * 1000);

        for (const threshold of REMINDER_DAYS) {
          if (contract.expiryRemindersSent.includes(threshold)) continue;
          if (daysUntilExpiry > 0 && daysUntilExpiry <= threshold) {
            const daysLabel =
              Math.ceil(daysUntilExpiry) === 1 ? "1 day" : `${Math.ceil(daysUntilExpiry)} days`;
            await emitContractSlaEvent({
              userId: contract.userId,
              contractId: contract.id,
              contractName: contract.name,
              trigger: "contract_expiring",
              details: `Data contract "${contract.name}" expires in ${daysLabel} (${contract.expiresAt.toLocaleDateString()}). Review schema and freshness SLAs before renewal.`,
            });
            await db.dataContract.update({
              where: { id: contract.id },
              data: { expiryRemindersSent: { push: threshold } },
            });
            result.expiryDispatched += 1;
            break;
          }
        }
      }

      if (!contract.freshnessSlaHours) continue;

      const pipelineIds = new Set<string>();
      for (const asset of contract.assets) {
        const pipelineId = asset.assetKey.split(":")[0]?.trim();
        if (pipelineId) pipelineIds.add(pipelineId);
      }

      let latestRun: { finishedAt: Date | null; startedAt: Date; pipelineId: string | null } | null =
        null;
      if (pipelineIds.size > 0) {
        const run = await db.eltPipelineRun.findFirst({
          where: {
            userId: contract.userId,
            pipelineId: { in: Array.from(pipelineIds) },
            status: "succeeded",
          },
          orderBy: { finishedAt: "desc" },
          select: { finishedAt: true, startedAt: true, pipelineId: true },
        });
        if (run) latestRun = run;
      }

      const lastFinished = latestRun?.finishedAt ?? latestRun?.startedAt ?? null;
      const health = freshnessHealth(lastFinished, contract.freshnessSlaHours);
      const previous = (contract.lastSlaStatus as SlaHealth | null) ?? null;

      if (health !== previous) {
        if (health === "at_risk" && (previous === "ok" || previous === null)) {
          const hoursLeft = contract.freshnessSlaHours
            ? Math.max(
                0,
                Math.round(
                  contract.freshnessSlaHours -
                    (lastFinished ? (Date.now() - lastFinished.getTime()) / (60 * 60 * 1000) : 0)
                )
              )
            : 0;
          await emitContractSlaEvent({
            userId: contract.userId,
            contractId: contract.id,
            contractName: contract.name,
            trigger: "sla_at_risk",
            details: `Freshness SLA at risk for "${contract.name}" — ~${hoursLeft}h remaining before ${contract.freshnessSlaHours}h limit.`,
            pipelineId: latestRun?.pipelineId ?? null,
          });
          result.slaTransitions += 1;
        } else if (
          health === "breached" &&
          (previous === "ok" || previous === "at_risk" || previous === null)
        ) {
          await emitContractSlaEvent({
            userId: contract.userId,
            contractId: contract.id,
            contractName: contract.name,
            trigger: "sla_breached",
            details: `Freshness SLA breached for "${contract.name}" — data is older than ${contract.freshnessSlaHours}h since last successful run.`,
            pipelineId: latestRun?.pipelineId ?? null,
          });
          result.slaTransitions += 1;
        }

        await db.dataContract.update({
          where: { id: contract.id },
          data: { lastSlaStatus: health },
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`${contract.slug}: ${msg}`);
    }
  }

  return result;
}
