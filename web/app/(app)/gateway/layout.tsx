import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gateway",
  description: "eltPulse execution gateway — tokens, connectors, and where ingestion runs.",
};

export default function GatewayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
