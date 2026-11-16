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
      subscriptionGraceDays(subscription),
      now,
    );
  }
  return false;
};

export const subscriptionGraceDays = (subscription: ArenaSubscription) =>
  Math.max(0, Number(subscription.grace_period_days ?? 5));

export const subscriptionCalendarDate = (date: string, extraDays = 0) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + extraDays);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
};

export const isDateWithinInclusiveWindow = (date: string, extraDays: number, now = new Date()) => {
  const exclusiveEnd = subscriptionCalendarDate(date, extraDays + 1);
  return exclusiveEnd !== null && now.getTime() < exclusiveEnd.getTime();
};

