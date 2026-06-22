import type { Metadata } from "next";
import { IntegrationsPanel } from "@/components/account/integrations-panel";

export const metadata: Metadata = {
  title: "Integrations",
};

export default function AccountIntegrationsPage() {
  return <IntegrationsPanel />;
}
