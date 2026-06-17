"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Mail, UserPlus } from "lucide-react";
import { BillingUpgradeButton } from "@/components/account/billing-upgrade-button";

type Org = {
  id: string;
  name: string;
  hasAgentToken: boolean;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  invitedAt: string;
};

export function OrganizationClient() {
  const [org, setOrg] = useState<Org | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [agentToken, setAgentToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orgRes, invRes] = await Promise.all([
        fetch("/api/organization", { credentials: "same-origin" }),
        fetch("/api/organization/invite", { credentials: "same-origin" }),
      ]);
      const orgData = (await orgRes.json()) as { organization?: Org | null };
      setOrg(orgData.organization ?? null);
      const invData = (await invRes.json()) as { invites?: Invite[] };
      setInvites(invData.invites ?? []);
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

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/organization/invite", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to invite");
      setInviteEmail("");
      setMessage("Invite recorded — they'll get access when they sign up with that email.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setInviting(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  if (!org) {
    return (
      <form onSubmit={(e) => void createOrg(e)} className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Create a team workspace to share pipelines, org-scoped gateway tokens, and billing.
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
          Org gateway: {org.hasAgentToken ? "configured" : "not set"} · Team plan unlocks shared RBAC (coming soon).
        </p>
        <div className="mt-4">
          <BillingUpgradeButton
            tier="team"
            label="Upgrade to Team"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          />
        </div>
      </div>

      <form onSubmit={(e) => void sendInvite(e)} className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <UserPlus className="h-4 w-4" /> Invite teammates
        </h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            required
            className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
          />
          <button
            type="submit"
            disabled={inviting}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send invite
          </button>
        </div>
        {invites.length > 0 ? (
          <ul className="text-xs text-slate-500">
            {invites.map((i) => (
              <li key={i.id}>
                {i.email} — invited {new Date(i.invitedAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
