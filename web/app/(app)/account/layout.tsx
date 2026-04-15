import type { Metadata } from "next";
import { AccountSettingsNav } from "@/components/account/account-settings-nav";

export const metadata: Metadata = {
  title: "Account & Settings",
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Account &amp; Settings</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Profile, billing, notifications, developers, organization, and compliance — in one place.
      </p>
      <div className="mt-8">
        <AccountSettingsNav />
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
