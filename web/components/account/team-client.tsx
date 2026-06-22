"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Cloud, Loader2, Mail, Server, UserPlus, Users, X } from "lucide-react";
import { BillingUpgradeButton } from "@/components/account/billing-upgrade-button";
import { BillingDedicatedComputeButton } from "@/components/account/billing-dedicated-compute-button";
import { BillingIntervalToggle } from "@/components/account/billing-interval-toggle";
import { BillingPortalButton } from "@/components/account/billing-portal-button";
import { formatUsd, PLAN_PRICES_USD, type BillingInterval } from "@/lib/billing/plan-pricing";

type Member = { id: string; email: string; name: string | null; createdAt: string };
type Invite = { id: string; email: string; role: string; invitedAt: string };

type TeamPayload = {
  role: "owner" | "member" | null;
  organization: { id: string; name: string } | null;
  owner?: Member;
  members: Member[];
  pendingInvites: Invite[];
  planTier?: string;
  canInvite?: boolean;
};

type ManagedComputePayload = {
  organizationId: string | null;
  canPurchaseDedicated: boolean;
  canEnableDedicated: boolean;
  planTier: string;
  billing: {
    subscribed: boolean;
    status: string | null;
    currentPeriodEnd: string | null;
  } | null;
  pricing: {
    platformFeeLabel: string;
    summary: string;
    checkoutConfigured: boolean;
  };
  status: {
    mode: "shared" | "dedicated";
    batchUrl: string | null;
    provisioned: boolean;
    isolatedQueue: boolean;
  } | null;
  label: string | null;
};

type InviteRole = "member" | "viewer" | "catalog_editor" | "catalog_browser";

const INVITE_ROLE_LABELS: Record<InviteRole, string> = {
  member: "Member (full edit)",
  viewer: "Viewer (read-only)",
  catalog_editor: "Catalog editor (metadata only)",
  catalog_browser: "Catalog browser (public entries)",
};

export function TeamClient() {
  const [data, setData] = useState<TeamPayload | null>(null);
  const [compute, setCompute] = useState<ManagedComputePayload | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("member");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, computeRes] = await Promise.all([
        fetch("/api/organization/members", { credentials: "same-origin" }),
        fetch("/api/organization/managed-compute", { credentials: "same-origin" }),
      ]);
      const json = (await teamRes.json()) as TeamPayload;
      setData(json);
      if (computeRes.ok) {
        setCompute((await computeRes.json()) as ManagedComputePayload);
      }
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
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
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
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Server className="h-4 w-4" /> Managed compute
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Shared managed compute is included on all plans — eltPulse runs your pipelines with zero gateway setup.
            <strong className="font-medium text-slate-800 dark:text-slate-200"> Dedicated compute</strong> is a paid
            add-on for Team workspaces: an isolated worker queue so other organizations never share or throttle your
            runs.
          </p>
          {compute?.pricing ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Dedicated pricing:{" "}
              <strong className="font-medium text-slate-700 dark:text-slate-300">
                {billingInterval === "annual"
                  ? `${formatUsd(PLAN_PRICES_USD.dedicatedCompute.annual)}/year + usage`
                  : compute.pricing.summary}
              </strong>
            </p>
          ) : null}
          {compute?.status ? (
            <div className="mt-4 space-y-3">
              {!compute.billing?.subscribed ? (
                <BillingIntervalToggle value={billingInterval} onChange={setBillingInterval} />
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    compute.status.mode === "dedicated"
                      ? "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  }`}
                >
                  <Cloud className="h-3.5 w-3.5" />
                  {compute.label ?? compute.status.mode}
                </span>
                {compute.billing?.subscribed && compute.billing.currentPeriodEnd ? (
                  <span className="text-xs text-slate-500">
                    Renews {new Date(compute.billing.currentPeriodEnd).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
              {compute.billing?.subscribed ? (
                <div className="flex flex-wrap gap-2">
                  <BillingPortalButton className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800" />
                </div>
              ) : null}
              {!compute.billing?.subscribed && compute.canPurchaseDedicated && compute.pricing.checkoutConfigured ? (
                <BillingDedicatedComputeButton
                  interval={billingInterval}
                  label={`Add dedicated compute — ${formatUsd(billingInterval === "annual" ? PLAN_PRICES_USD.dedicatedCompute.annual : PLAN_PRICES_USD.dedicatedCompute.monthly)}/${billingInterval === "annual" ? "yr" : "mo"} + usage`}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                />
              ) : null}
              {!compute.canPurchaseDedicated && !compute.billing?.subscribed ? (
                <BillingUpgradeButton
                  tier="team"
                  label="Upgrade to Team to purchase dedicated compute"
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                />
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {isOwner ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          {!data.canInvite ? (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <UserPlus className="h-4 w-4" /> Invite teammates
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Team invites require the Team plan. Upgrade to invite colleagues and share pipelines, runs, and
                connections.
              </p>
              <BillingUpgradeButton
                tier="team"
                label="Upgrade to Team"
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              />
            </div>
          ) : (
            <>
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
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as InviteRole)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                  >
                    {(Object.keys(INVITE_ROLE_LABELS) as InviteRole[]).map((r) => (
                      <option key={r} value={r}>
                        {INVITE_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
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
                        {i.email} — {INVITE_ROLE_LABELS[i.role as InviteRole] ?? i.role} — pending since{" "}
                        {new Date(i.invitedAt).toLocaleDateString()}
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
            </>
          )}
        </section>
      ) : null}

      {message ? <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p> : null}
    </div>
  );
}
