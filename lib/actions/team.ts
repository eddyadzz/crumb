'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { requireTenant, requireTenantWritable, requireFeature } from '@/lib/tenant';
import { recordActivity } from '@/lib/activity';
import { sendInviteEmail } from '@/lib/mail';
import {
  generateInviteToken,
  invokeExpiresAt,
  isInviteValid,
  isValidTeamEmail,
  canManageRole,
  INVITABLE_ROLES,
} from '@/lib/team-core';
import type { UserRole } from '@prisma/client';

export interface MemberRow {
  id: string;
  userId: string;
  role: UserRole;
  name: string;
  email: string;
  joinedAt: string;
}

export interface InvitationRow {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  expiresAt: string;
}

export async function teamList() {
  const ctx = await requireTenant();
  const [members, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { tenantId: ctx.tenantId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.invitation.findMany({
      where: { tenantId: ctx.tenantId, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    role: ctx.role as UserRole,
    isOwner: ctx.isOwner,
    members: members.map((m): MemberRow => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      name: m.user.name,
      email: m.user.email,
      joinedAt: m.createdAt.toISOString(),
    })),
    invitations: invitations
      .filter((inv) => isInviteValid(inv.expiresAt))
      .map((inv): InvitationRow => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        createdAt: inv.createdAt.toISOString(),
        expiresAt: inv.expiresAt.toISOString(),
      })),
  };
}

/** Only OWNER / MANAGER may manage the team. */
async function requireTeamManager(): Promise<Awaited<ReturnType<typeof requireTenantWritable>>> {
  const ctx = await requireTenantWritable();
  if (ctx.role !== 'OWNER' && ctx.role !== 'MANAGER') {
    throw new Error('You do not have permission to manage the team');
  }
  return ctx;
}

export async function teamInvite(input: { email: string; role: 'MANAGER' | 'STAFF' }) {
  const ctx = await requireFeature('multiUser');
  if (ctx.role !== 'OWNER' && ctx.role !== 'MANAGER') {
    return { error: 'Only the owner or a manager can send invitations' };
  }

  const email = input.email.trim().toLowerCase();
  if (!isValidTeamEmail(email)) return { error: 'Enter a valid email address' };
  if (!INVITABLE_ROLES.includes(input.role)) return { error: 'Invalid role' };

  // Can't invite someone who is already a member of this tenant.
  const existingMember = await prisma.membership.findFirst({
    where: { tenantId: ctx.tenantId, user: { email } },
    select: { id: true },
  });
  if (existingMember) return { error: `${email} is already a team member` };

  // A pending invite to the same email supersedes the old one.
  const existingInvite = await prisma.invitation.findFirst({
    where: { tenantId: ctx.tenantId, email, acceptedAt: null },
    select: { id: true },
  });
  if (existingInvite) {
    await prisma.invitation.delete({ where: { id: existingInvite.id } });
  }

  const token = generateInviteToken();
  const expiresAt = invokeExpiresAt();

  const invitation = await prisma.invitation.create({
    data: {
      tenantId: ctx.tenantId,
      email,
      role: input.role,
      token,
      expiresAt,
      invitedById: ctx.userId,
    },
    include: { tenant: { select: { name: true } } },
  });

  await recordActivity({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    actorName: ctx.name,
    type: 'INVITE_SENT',
    title: `Invited ${email}`,
    description: `as ${roleLabel(input.role)}`,
    entityType: 'Invitation',
    entityId: invitation.id,
  });

  // Best-effort email — the invitation is already persisted.
  await sendInviteEmail({
    to: email,
    tenantName: invitation.tenant.name,
    role: input.role,
    inviteUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/invite/${token}`,
  }).catch((err) => console.error('[crumb:team] invite email failed', err));

  revalidatePath('/settings');
  return { ok: true };
}

export async function teamCancelInvitation(invitationId: string) {
  await requireTeamManager();
  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation) return { error: 'Invitation not found' };
  await prisma.invitation.delete({ where: { id: invitationId } });
  revalidatePath('/settings');
  return { ok: true };
}

export async function teamRemoveMember(memberId: string) {
  const ctx = await requireTeamManager();
  const membership = await prisma.membership.findUnique({
    where: { id: memberId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!membership || membership.tenantId !== ctx.tenantId) return { error: 'Member not found' };

  // Can't remove yourself or the tenant owner.
  if (membership.userId === ctx.userId) return { error: 'You cannot remove yourself' };
  if (membership.role === 'OWNER') return { error: 'You cannot remove the owner' };
  if (!canManageRole(ctx.role as UserRole, membership.role)) {
    return { error: 'You cannot remove this member' };
  }

  await prisma.membership.delete({ where: { id: memberId } });

  // If removed member's active tenant is this one, clear their active pointer.
  await prisma.user.updateMany({
    where: { id: membership.userId, tenantId: ctx.tenantId },
    data: { tenantId: null },
  });

  await recordActivity({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    actorName: ctx.name,
    type: 'MEMBER_REMOVED',
    title: `Removed ${membership.user.name || membership.user.email}`,
    entityType: 'Membership',
    entityId: memberId,
  });

  revalidatePath('/settings');
  return { ok: true };
}

export async function teamChangeRole(memberId: string, role: 'MANAGER' | 'STAFF') {
  const ctx = await requireTeamManager();
  const membership = await prisma.membership.findUnique({
    where: { id: memberId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!membership || membership.tenantId !== ctx.tenantId) return { error: 'Member not found' };
  if (!INVITABLE_ROLES.includes(role)) return { error: 'Invalid role' };

  const target = membership.role as UserRole;
  if (!canManageRole(ctx.role as UserRole, target)) {
    return { error: 'You cannot change this member’s role' };
  }
  if (target === role) return { ok: true };

  await prisma.membership.update({
    where: { id: memberId },
    data: { role },
  });

  await recordActivity({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    actorName: ctx.name,
    type: 'ROLE_CHANGED',
    title: `Changed ${membership.user.name || membership.user.email}'s role`,
    description: `${roleLabel(target)} → ${roleLabel(role)}`,
    entityType: 'Membership',
    entityId: memberId,
  });

  revalidatePath('/settings');
  return { ok: true };
}

/**
 * Accept a pending invite for the signed-in user. The user's email must match
 * the invited address, or the acceptance is refused.
 */
export async function teamAcceptInvitation(token: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user) return { error: 'AUTH_REQUIRED' };

  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) return { error: 'This invitation is no longer valid' };
  if (!isInviteValid(invitation.expiresAt)) {
    return { error: 'This invitation has expired' };
  }
  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return { error: 'This invitation was sent to a different email address' };
  }

  // Idempotent: joining twice yields one membership.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({
      where: {
        userId_tenantId: { userId: user.id, tenantId: invitation.tenantId },
      },
      select: { id: true },
    });
    if (!existing) {
      await tx.membership.create({
        data: { userId: user.id, tenantId: invitation.tenantId, role: invitation.role },
      });
    }
    await tx.user.update({ where: { id: user.id }, data: { tenantId: invitation.tenantId } });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: invitation.tenantId },
    select: { name: true },
  });

  await recordActivity({
    tenantId: invitation.tenantId,
    actorUserId: user.id,
    actorName: user.name ?? user.email ?? undefined,
    type: 'INVITE_ACCEPTED',
    title: `${user.name || user.email} joined`,
    description: `as ${roleLabel(invitation.role)}`,
    entityType: 'Invitation',
    entityId: invitation.id,
  });

  revalidatePath('/');
  return { ok: true, tenantName: tenant?.name ?? null };
}

function roleLabel(role: string): string {
  return { OWNER: 'owner', MANAGER: 'manager', STAFF: 'staff' }[role] ?? role.toLowerCase();
}