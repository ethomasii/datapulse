"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Users } from "lucide-react";
import { BillingUpgradeButton } from "@/components/account/billing-upgrade-button";
import { ComponentCatalogSettings } from "@/components/elt/component-catalog-settings";

type Org = {
  id: string;
  name: string;
  hasAgentToken: boolean;
};

export function OrganizationClient() {
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [agentToken, setAgentToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const orgRes = await fetch("/api/organization", { credentials: "same-origin" });
      const orgData = (await orgRes.json()) as { organization?: Org | null };
      setOrg(orgData.organization ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/organization", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim() || "My team" }),
      });
      const data = (await res.json()) as { agentToken?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create organization");
      if (data.agentToken) setAgentToken(data.agentToken);
      setMessage("Organization created.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  if (!org) {
    return (
      <form onSubmit={(e) => void createOrg(e)} className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Create an organization workspace to share pipelines, org-scoped gateway tokens, and Team-tier billing. After
          setup, invite colleagues from the{" "}
          <Link href="/account/team" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Team
          </Link>{" "}
          tab.
        </p>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Organization name</span>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Data Team"
            className="mt-1 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
          />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
          Create organization
        </button>
        {agentToken ? (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Org gateway token (save now): <code className="break-all">{agentToken}</code>
          </p>
        ) : null}
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </form>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white">{org.name}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Org gateway token: {org.hasAgentToken ? "configured" : "not set"} · Members and invites live on{" "}
          <Link href="/account/team" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Team
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/account/team"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Users className="h-4 w-4" aria-hidden />
            Manage team
          </Link>
          <BillingUpgradeButton
            tier="team"
            label="Upgrade to Team"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950">
        <ComponentCatalogSettings />
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
