import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { InviteAcceptClient } from "@/components/account/invite-accept-client";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const invite = await db.organizationInvite.findUnique({
    where: { id },
    include: { organization: { select: { name: true } } },
  });
  return {
    title: invite ? `Join ${invite.organization.name}` : "Team invite",
  };
}

export default async function InvitePage({ params }: Props) {
  const { id } = await params;
  const invite = await db.organizationInvite.findUnique({
    where: { id },
    include: { organization: { select: { name: true } } },
  });
  if (!invite || invite.acceptedAt) notFound();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <InviteAcceptClient inviteId={id} organizationName={invite.organization.name} />
    </div>
  );
}
