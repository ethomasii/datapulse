import { requireDbUser } from "@/lib/auth/server";
import { canReceiveAlertNotifications, getEffectiveTier } from "@/lib/plans/plan-enforcement";
import { ObservabilityClient } from "./observability-client";

export default async function ObservabilityPage() {
  const user = await requireDbUser();
  const effectiveTier = getEffectiveTier(user.subscription);
  const alertDelivery = canReceiveAlertNotifications(user.subscription, effectiveTier);

  return (
    <ObservabilityClient
      alertDeliveryAllowed={alertDelivery.allowed}
      alertDeliveryReason={alertDelivery.reason}
      alertDeliveryMinTier={alertDelivery.upgradeRequired ?? "pro"}
    />
  );
}
