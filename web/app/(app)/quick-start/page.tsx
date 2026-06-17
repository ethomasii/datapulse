import { QuickStartWizard } from "@/components/elt/quick-start-wizard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quick start",
  description: "Create and run your first eltPulse pipeline in minutes.",
};

export default function QuickStartPage() {
  return <QuickStartWizard />;
}
