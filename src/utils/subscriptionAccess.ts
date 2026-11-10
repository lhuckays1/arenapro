import type { ArenaSubscription } from '../types';

/** Mirrors public.has_active_arena_subscription() including the configured grace window. */
export const hasOperationalSubscriptionAccess = (subscription: ArenaSubscription | null | undefined, now = new Date()) => {
  if (!subscription) return false;
  if (subscription.status === 'ACTIVE') {
    return !subscription.current_period_end || isDateWithinInclusiveWindow(subscription.current_period_end, 0, now);
  }
  if (subscription.status === 'PAST_DUE' && subscription.current_period_end) {
    return isDateWithinInclusiveWindow(
      subscription.current_period_end,
      Math.max(0, Number(subscription.grace_period_days ?? 5)),
      now,
    );
  }
  return false;
};

export const isDateWithinInclusiveWindow = (date: string, extraDays: number, now = new Date()) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return false;
  const exclusiveEnd = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + extraDays + 1);
  return now.getTime() < exclusiveEnd;
};

