import type { Metadata } from "next";
import { AppPage, AppPageHeader } from "@/components/layout/app-page";
import { AccountSettingsNav } from "@/components/account/account-settings-nav";

export const metadata: Metadata = {
  title: "Account & Settings",
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppPage width="narrow">
      <AppPageHeader
        title="Account & Settings"
        description="Profile, billing, notifications, developers, organization, and compliance — in one place."
      />
      <AccountSettingsNav />
      <div>{children}</div>
    </AppPage>
  );
}
