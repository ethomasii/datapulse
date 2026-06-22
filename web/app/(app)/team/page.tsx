import { AppPage, AppPageHeader } from "@/components/layout/app-page";
import type { Metadata } from "next";
import { TeamClient } from "@/components/account/team-client";

export const metadata: Metadata = {
  title: "Team",
};

export default function TeamPage() {
  return (
    <AppPage width="default">
      <AppPageHeader
        eyebrow="Collaboration"
        title="Team"
        description="Invite colleagues into your organization workspace. Members see shared pipelines, runs, and connections owned by the organization."
      />
      <TeamClient />
    </AppPage>
  );
}
