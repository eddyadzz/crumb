/** Pure trial/subscription helpers — no server or React dependencies, so they
 * are unit-testable and safe for both server (lib/tenant) and client (AppShell). */

export function isTrialExpired(
  subscriptionStatus: string,
  trialEndsAt: Date | null,
  now: Date = new Date()
): boolean {
  return (
    subscriptionStatus === 'TRIAL' &&
    trialEndsAt !== null &&
    trialEndsAt.getTime() <= now.getTime()
  );
}

export function trialDaysLeft(
  trialEndsAt: string | Date | null,
  now: Date = new Date()
): number | null {
  if (!trialEndsAt) return null;
  const end = typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : trialEndsAt;
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}