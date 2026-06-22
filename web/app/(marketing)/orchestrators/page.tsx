import { redirect } from "next/navigation";

/** Top-level /orchestrators matches ServicePulse nav; orchestration docs are the source of truth. */
export default function OrchestratorsPage() {
  redirect("/docs/orchestration");
}
