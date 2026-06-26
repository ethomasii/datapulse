import type { Metadata } from "next";
import { StarterWarehouseSetup } from "@/components/elt/starter-warehouse-setup";

export const metadata: Metadata = {
  title: "Starter warehouse",
  description: "Set up a free MotherDuck warehouse for eltPulse in minutes.",
};

export default function StarterWarehousePage() {
  return <StarterWarehouseSetup />;
}
