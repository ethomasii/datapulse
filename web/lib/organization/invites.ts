import { getResend, defaultFrom } from "@/lib/email/resend";
import { appBaseUrl } from "@/lib/billing/stripe";
import { db } from "@/lib/db/client";

export async function sendOrganizationInviteEmail(options: {
  inviteId: string;
  email: string;
  organizationName: string;
  inviterName: string | null;
}): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const base = appBaseUrl();
  const acceptUrl = `${base}/invite/${options.inviteId}`;
  const from = defaultFrom();
  const inviter = options.inviterName?.trim() || "A teammate";

  try {
    await resend.emails.send({
      from: `${from.name} <${from.email}>`,
      to: options.email,
      subject: `Join ${options.organizationName} on eltPulse`,
      html: `
        <p>${inviter} invited you to join <strong>${options.organizationName}</strong> on eltPulse.</p>
        <p><a href="${acceptUrl}">Accept invitation</a></p>
        <p>Or sign up at ${base}/sign-up with this email address.</p>
        <p style="color:#64748b;font-size:12px">If you did not expect this invite, you can ignore this email.</p>
      `,
    });
    return true;
  } catch {
    return false;
  }
}

/** Match pending invites by email and attach user to the organization. */
export async function acceptPendingInvitesForUser(userId: string, email: string): Promise<number> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return 0;

  const pending = await db.organizationInvite.findMany({
    where: { email: normalized, acceptedAt: null },
    select: { id: true, organizationId: true },
  });
  if (pending.length === 0) return 0;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (user?.organizationId) return 0;

  const invite = pending[0];
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { organizationId: invite.organizationId },
    }),
    db.organizationInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return 1;
}

export async function acceptInviteById(userId: string, email: string, inviteId: string) {
  const invite = await db.organizationInvite.findUnique({
    where: { id: inviteId },
    include: { organization: { select: { name: true, ownerUserId: true } } },
  });
  if (!invite || invite.acceptedAt) {
    return { ok: false as const, status: 404, message: "Invite not found or already accepted" };
  }
  if (invite.email !== email.trim().toLowerCase()) {
    return {
      ok: false as const,
      status: 403,
      message: "This invite was sent to a different email address. Sign in with the invited email.",
    };
  }

  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (existing?.organizationId && existing.organizationId !== invite.organizationId) {
    return { ok: false as const, status: 409, message: "You already belong to another organization." };
  }

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { organizationId: invite.organizationId },
    }),
    db.organizationInvite.update({
      where: { id: inviteId },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return {
    ok: true as const,
    organizationName: invite.organization.name,
    ownerUserId: invite.organization.ownerUserId,
  };
}
