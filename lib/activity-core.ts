/**
 * Pure activity-event logic — no server/DB/React imports so it is unit-testable.
 * Provides default presentation copy per activity type and a small builder used
 * to keep the in-app timeline readable and consistent.
 */
import type { ActivityType } from '@prisma/client';

export interface ActivityInput {
  actorName?: string | null;
  type: ActivityType;
  title: string;
  description?: string | null;
}

/** Prefix an actor name onto a human-readable title, e.g. "Ahmed created Order #102". */
export function withActor(input: ActivityInput): string {
  if (!input.actorName) return input.title;
  return `${input.actorName} ${input.title}`;
}

/** A short, neutral label for an event type (used by filters / icons). */
export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  ORDER_CREATED: 'Order created',
  ORDER_CONFIRMED: 'Order confirmed',
  ORDER_CANCELLED: 'Order cancelled',
  PRODUCTION_CREATED: 'Production started',
  PRODUCTION_COMPLETED: 'Production completed',
  PRODUCTION_CANCELLED: 'Production cancelled',
  SALE_COMPLETED: 'Sale completed',
  UPGRADE_REQUESTED: 'Upgrade requested',
  UPGRADE_APPROVED: 'Upgrade approved',
  UPGRADE_REJECTED: 'Upgrade rejected',
  USER_INVITED: 'User invited',
  USER_REMOVED: 'User removed',
  INVITE_SENT: 'Invite sent',
  INVITE_ACCEPTED: 'Invite accepted',
  MEMBER_REMOVED: 'Member removed',
  ROLE_CHANGED: 'Role changed',
  SYSTEM: 'System',
};

/** Default title for an event type when the caller doesn't supply one. */
export function defaultTitle(type: ActivityType): string {
  return ACTIVITY_TYPE_LABEL[type];
}