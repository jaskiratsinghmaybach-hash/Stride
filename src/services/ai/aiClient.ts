/**
 * AI boundary for STRIDE.
 *
 * Important architecture rules:
 * 1. Do not call Gemini for every phone event.
 *    Local indexing/classification happens first. Only meaningful reasoning
 *    jobs enter this queue.
 * 2. Cost/Quota Safety:
 *    Daily job-count cap: 30 jobs per user per calendar day.
 *    Resets at midnight.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { scheduleDebouncedAiDrain } from "./aiWorker";

export type AiJobType =
  | "understand_document"
  | "understand_image"
  | "extract_actions"
  | "suggest_actions"
  | "build_daily_plan"
  | "connect_context";

export type AiJob = {
  id: string;
  type: AiJobType;
  priority: "low" | "normal" | "high";
  payload: unknown;
  enqueuedAt?: string;
  attempts?: number;
};

export const DAILY_AI_JOB_CAP = 30;

function getAiQueueKey(userId: string): string {
  return `stride.ai_queue.${userId}`;
}

function getDailyUsageKey(userId: string, dateStr: string): string {
  return `stride.ai_daily_usage.${userId}.${dateStr}`;
}

export async function getAiQueue(userId: string): Promise<AiJob[]> {
  try {
    const raw = await AsyncStorage.getItem(getAiQueueKey(userId));
    if (!raw) return [];
    const entries: AiJob[] = JSON.parse(raw);
    return Array.isArray(entries) ? entries : [];
  } catch (err) {
    console.warn("[AiClient] Failed to read AI queue", err);
    return [];
  }
}

export async function getAiDailyUsage(userId: string): Promise<{ count: number; isCapped: boolean }> {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const raw = await AsyncStorage.getItem(getDailyUsageKey(userId, todayStr));
    const count = raw ? parseInt(raw, 10) || 0 : 0;
    return {
      count,
      isCapped: count >= DAILY_AI_JOB_CAP,
    };
  } catch {
    return { count: 0, isCapped: false };
  }
}

export async function incrementAiDailyUsage(userId: string): Promise<number> {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const key = getDailyUsageKey(userId, todayStr);
    const raw = await AsyncStorage.getItem(key);
    const next = (raw ? parseInt(raw, 10) || 0 : 0) + 1;
    await AsyncStorage.setItem(key, next.toString());
    return next;
  } catch {
    return 1;
  }
}

/**
 * Enqueue an AI job for asynchronous worker processing.
 * Accepts either (userId, job) or (job) for backwards-compatibility with previous call sites.
 */
export async function enqueueAiJob(
  userOrJob: string | AiJob,
  maybeJob?: AiJob
): Promise<void> {
  const userId = typeof userOrJob === "string" ? userOrJob : "default_user";
  const job = typeof userOrJob === "string" ? maybeJob! : userOrJob;

  if (!job) return;

  try {
    // Check daily cap
    const { isCapped, count } = await getAiDailyUsage(userId);
    if (isCapped) {
      console.info(`[AiClient] AI understanding paused for today (reached daily cap of ${DAILY_AI_JOB_CAP}, current: ${count})`);
      return;
    }

    const queue = await getAiQueue(userId);

    const newJob: AiJob = {
      ...job,
      enqueuedAt: job.enqueuedAt || new Date().toISOString(),
      attempts: job.attempts || 0,
    };

    queue.push(newJob);
    await AsyncStorage.setItem(getAiQueueKey(userId), JSON.stringify(queue));

    // Trigger debounced drain
    scheduleDebouncedAiDrain(userId);
  } catch (err) {
    console.warn("[AiClient] Failed to enqueue AI job", err);
  }
}

export async function removeAiJobsFromQueue(userId: string, jobIds: string[]): Promise<void> {
  try {
    const queue = await getAiQueue(userId);
    const idSet = new Set(jobIds);
    const remaining = queue.filter((j) => !idSet.has(j.id));
    await AsyncStorage.setItem(getAiQueueKey(userId), JSON.stringify(remaining));
  } catch (err) {
    console.warn("[AiClient] Failed to remove AI jobs", err);
  }
}

export async function incrementAiJobAttempts(userId: string, jobId: string): Promise<void> {
  try {
    const queue = await getAiQueue(userId);
    const idx = queue.findIndex((j) => j.id === jobId);
    if (idx === -1) return;
    queue[idx].attempts = (queue[idx].attempts || 0) + 1;
    await AsyncStorage.setItem(getAiQueueKey(userId), JSON.stringify(queue));
  } catch (err) {
    console.warn("[AiClient] Failed to increment AI job attempts", err);
  }
}
