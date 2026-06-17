import { QuickStartWizard } from "@/components/elt/quick-start-wizard";
import type { Metadata } from "next";
import { scenarioById } from "@/lib/marketing/pipeline-scenarios";

export const metadata: Metadata = {
  title: "Quick start",
  description: "Create and run your first eltPulse pipeline in minutes.",
};

type Props = {
  searchParams: Promise<{
    source?: string;
    destination?: string;
    scenario?: string;
  }>;
};

export default async function QuickStartPage({ searchParams }: Props) {
  const sp = await searchParams;
  const scenario = sp.scenario ? scenarioById(sp.scenario) : undefined;

  return (
    <QuickStartWizard
      initialSource={sp.source ?? scenario?.sourceSlug}
      initialDestination={sp.destination ?? scenario?.destinationSlug}
      scenarioId={sp.scenario}
      scenarioTitle={scenario?.title}
    />
  );
}
