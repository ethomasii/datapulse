import type { Metadata } from "next";
import { PricingPageClient } from "@/components/marketing/pricing-page-client";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent eltPulse pricing — start free, upgrade to Pro or Team, or run self-hosted on Enterprise. Annual billing saves 2 months.",
};

export default function PricingPage() {
  return <PricingPageClient />;
}
