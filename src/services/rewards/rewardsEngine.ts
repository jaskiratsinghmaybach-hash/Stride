/**
 * STRIDE Rewards Engine — Client-Computed Placeholder
 *
 * ARCHITECTURAL NOTICE:
 * This is a client-computed calculation layer for the local-only / display phase.
 * It computes points and streaks strictly derived from real FocusSession history
 * (focus_sessions).
 *
 * When moving to real subscription / monetary redemption (Stride Pro in a later phase),
 * this client-computed layer MUST be superseded by the server-side authoritative
 * `public.reward_ledger` table and trusted Edge Function ledger writer to prevent
 * client-side point manipulation.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FocusSession } from "@/types/focus";
import { getFocusSessions } from "../focus/focusClient";

export type RewardsSummary = {
  totalPoints: number;
  currentStreak: number;
  todaySessionPointsEarned: number;
  todaySessionPointsCapped: boolean;
  historyByDay: Record<string, number>; // dateStr -> credited session count
};

const POINTS_PER_SESSION = 10;
const MIN_SESSION_SECONDS = 900; // 15 minutes floor
const MAX_SESSIONS_PER_DAY = 2; // max 20 points per day from sessions

const MILESTONES: Array<{ days: number; key: string; bonusPoints: number }> = [
  { days: 3, key: "streak_milestone_3", bonusPoints: 25 },
  { days: 7, key: "streak_milestone_7", bonusPoints: 75 },
  { days: 14, key: "streak_milestone_14", bonusPoints: 200 },
  { days: 30, key: "streak_milestone_30", bonusPoints: 500 },
];

function getMilestoneKey(userId: string): string {
  return `stride.awarded_milestones.${userId}`;
}

export function toLocalDateString(isoDateString: string): string {
  const d = new Date(isoDateString);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isCreditedSession(session: FocusSession): boolean {
  return (
    session.status === "completed" &&
    (session.durationSeconds || 0) >= MIN_SESSION_SECONDS
  );
}

export function computeStreakAndHistory(sessions: FocusSession[]): {
  currentStreak: number;
  byDay: Record<string, number>;
} {
  const byDay: Record<string, number> = {};

  for (const s of sessions) {
    if (!isCreditedSession(s) || !s.startedAt) continue;
    const dayStr = toLocalDateString(s.startedAt);
    if (!dayStr) continue;
    byDay[dayStr] = (byDay[dayStr] || 0) + 1;
  }

  const now = new Date();
  const todayStr = toLocalDateString(now.toISOString());

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateString(yesterday.toISOString());

  // Determine starting point for streak calculation
  let streak = 0;
  let checkDate = new Date(now);

  if (byDay[todayStr] && byDay[todayStr] > 0) {
    // Today has activity, count backward from today
    checkDate = now;
  } else if (byDay[yesterdayStr] && byDay[yesterdayStr] > 0) {
    // Yesterday had activity, today is still in progress
    checkDate = yesterday;
  } else {
    // Neither today nor yesterday had activity -> streak broken
    return { currentStreak: 0, byDay };
  }

  while (true) {
    const dStr = toLocalDateString(checkDate.toISOString());
    if (byDay[dStr] && byDay[dStr] > 0) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return { currentStreak: streak, byDay };
}

export async function getAwardedMilestones(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(getMilestoneKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function checkAndAwardMilestones(
  userId: string,
  currentStreak: number
): Promise<number> {
  const awarded = await getAwardedMilestones(userId);
  const newlyAwarded = [...awarded];
  let bonusTotal = 0;

  for (const m of MILESTONES) {
    if (currentStreak >= m.days) {
      if (!newlyAwarded.includes(m.key)) {
        newlyAwarded.push(m.key);
      }
    }
  }

  if (newlyAwarded.length !== awarded.length) {
    try {
      await AsyncStorage.setItem(getMilestoneKey(userId), JSON.stringify(newlyAwarded));
    } catch (err) {
      console.warn("[Rewards] Failed to persist awarded milestone", err);
    }
  }

  for (const key of newlyAwarded) {
    const m = MILESTONES.find((item) => item.key === key);
    if (m) bonusTotal += m.bonusPoints;
  }

  return bonusTotal;
}

export async function getRewardsSummary(userId: string): Promise<RewardsSummary> {
  const sessions = await getFocusSessions(userId);
  const { currentStreak, byDay } = computeStreakAndHistory(sessions);

  // Compute total session points across history (capped per calendar day)
  let sessionPointsTotal = 0;
  for (const count of Object.values(byDay)) {
    const creditedCount = Math.min(count, MAX_SESSIONS_PER_DAY);
    sessionPointsTotal += creditedCount * POINTS_PER_SESSION;
  }

  // Milestone points
  const milestoneBonus = await checkAndAwardMilestones(userId, currentStreak);
  const totalPoints = sessionPointsTotal + milestoneBonus;

  // Today specific calculations
  const todayStr = toLocalDateString(new Date().toISOString());
  const todayCreditedCount = byDay[todayStr] || 0;
  const todayPointsEarned = Math.min(todayCreditedCount, MAX_SESSIONS_PER_DAY) * POINTS_PER_SESSION;
  const todaySessionPointsCapped = todayCreditedCount >= MAX_SESSIONS_PER_DAY;

  return {
    totalPoints,
    currentStreak,
    todaySessionPointsEarned: todayPointsEarned,
    todaySessionPointsCapped,
    historyByDay: byDay,
  };
}
