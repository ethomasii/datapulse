"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Loader2, Mail, UserPlus, Users, X } from "lucide-react";
import { BillingUpgradeButton } from "@/components/account/billing-upgrade-button";

type Member = { id: string; email: string; name: string | null; createdAt: string };
type Invite = { id: string; email: string; role: string; invitedAt: string };

type TeamPayload = {
  role: "owner" | "member" | null;
  organization: { id: string; name: string } | null;
  owner?: Member;
  members: Member[];
  pendingInvites: Invite[];
};

export function TeamClient() {
  const [data, setData] = useState<TeamPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/organization/members", { credentials: "same-origin" });
      const json = (await res.json()) as TeamPayload;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      const body = (await res.json()) as { error?: string; emailed?: boolean };
      if (!res.ok) throw new Error(body.error ?? "Failed to invite");
      setInviteEmail("");
      setMessage(body.emailed ? "Invite sent by email." : "Invite recorded (configure Resend to send email).");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setInviting(false);
    }
  }

  async function revokeInvite(id: string) {
    setMessage(null);
    const res = await fetch(`/api/organization/invite/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!res.ok) {
      setMessage("Could not revoke invite");
      return;
    }
    await load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading team…</p>;

  if (!data?.organization) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
        <Users className="mx-auto h-10 w-10 text-slate-400" />
        <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No team yet</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Create an organization to invite colleagues and share pipelines.
        </p>
        <Link
          href="/account/organization"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          <Building2 className="h-4 w-4" /> Set up organization
        </Link>
      </div>
    );
  }

  const isOwner = data.role === "owner";

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{data.organization.name}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {isOwner ? "You own this workspace." : `Member of ${data.owner?.name ?? data.owner?.email ?? "team"}'s workspace.`}
        </p>
        {isOwner ? (
          <div className="mt-4">
            <BillingUpgradeButton
              tier="team"
              label="Upgrade to Team"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            />
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Users className="h-4 w-4" /> Members ({data.members.length})
        </h3>
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {data.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium text-slate-800 dark:text-slate-200">{m.name ?? m.email}</span>
              <span className="text-xs text-slate-500">{m.email}</span>
            </li>
          ))}
        </ul>
      </section>

      {isOwner ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
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
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send invite
              </button>
            </div>
          </form>
          {data.pendingInvites.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {data.pendingInvites.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950"
                >
                  <span>
                    {i.email} — pending since {new Date(i.invitedAt).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => void revokeInvite(i.id)}
                    className="text-slate-500 hover:text-red-600"
                    aria-label={`Revoke invite for ${i.email}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {message ? <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p> : null}
    </div>
  );
}
