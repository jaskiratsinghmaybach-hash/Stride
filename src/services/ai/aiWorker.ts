/**
 * STRIDE AI Queue Worker
 *
 * Drains queued reasoning jobs asynchronously with debouncing, concurrency limits,
 * retry caps, and credit-budget daily caps.
 *
 * UI code NEVER calls Vertex/Gemini directly; all requests enter via aiClient.ts
 * and are drained here.
 */

import {
  getAiQueue,
  removeAiJobsFromQueue,
  incrementAiJobAttempts,
  incrementAiDailyUsage,
  getAiDailyUsage,
  type AiJob,
} from "./aiClient";
import * as vertexClient from "./vertexClient";
import { updateContextItem, getContextItems, relateContextToTask } from "../vault/vaultClient";
import { createTask, getTask } from "../tasks/taskClient";
import type { TaskPriority } from "@/types/task";

const MAX_AI_ATTEMPTS = 3;
const CONCURRENT_JOBS = 2;
const DEBOUNCE_MS = 2500;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isDraining = false;

export function scheduleDebouncedAiDrain(userId: string): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    drainAiQueue(userId).catch((err) => {
      console.warn("[AiWorker] Debounced drain failed", err);
    });
  }, DEBOUNCE_MS);
}

export async function drainAiQueue(userId: string): Promise<void> {
  if (isDraining) return;

  try {
    isDraining = true;

    // Check daily safety cap
    const { isCapped } = await getAiDailyUsage(userId);
    if (isCapped) {
      console.info("[AiWorker] Drain skipped: daily AI cap reached");
      return;
    }

    const queue = await getAiQueue(userId);
    if (queue.length === 0) return;

    const eligible = queue.filter((j) => (j.attempts || 0) < MAX_AI_ATTEMPTS);
    if (eligible.length === 0) return;

    // Process up to CONCURRENT_JOBS concurrently
    for (let i = 0; i < eligible.length; i += CONCURRENT_JOBS) {
      const batch = eligible.slice(i, i + CONCURRENT_JOBS);
      await Promise.all(batch.map((job) => processSingleJob(userId, job)));
    }
  } finally {
    isDraining = false;
  }
}

async function processSingleJob(userId: string, job: AiJob): Promise<void> {
  const payload = job.payload as Record<string, any> || {};

  try {
    switch (job.type) {
      case "understand_document": {
        const text = payload.text || payload.content || payload.title;
        const title = payload.title;
        const contextId = payload.contextId;

        const res = await vertexClient.understandDocument(text, title);

        if (contextId) {
          await updateContextItem(userId, contextId, {
            aiState: "analyzed",
            aiSummary: res.summary,
          });
        }
        await incrementAiDailyUsage(userId);
        await removeAiJobsFromQueue(userId, [job.id]);
        break;
      }

      case "understand_image": {
        const uri = payload.uri;
        const title = payload.title;
        const contextId = payload.contextId;

        const res = await vertexClient.understandImage(uri, title);

        if (contextId) {
          await updateContextItem(userId, contextId, {
            aiState: "analyzed",
            aiSummary: res.summary,
          });
        }
        await incrementAiDailyUsage(userId);
        await removeAiJobsFromQueue(userId, [job.id]);
        break;
      }

      case "extract_actions": {
        const freeText = payload.rawText || payload.freeText || "";
        if (freeText.trim()) {
          const actions = await vertexClient.extractActions(freeText);
          for (const item of actions) {
            if (item.title) {
              const priority: TaskPriority =
                item.priority === "high" || item.priority === "low" ? item.priority : "normal";
              await createTask(userId, {
                title: item.title,
                priority,
                dueDate: item.dueDate || undefined,
                projectId: item.project || undefined,
                status: "inbox",
              });
            }
          }
        }
        await incrementAiDailyUsage(userId);
        await removeAiJobsFromQueue(userId, [job.id]);
        break;
      }

      case "connect_context": {
        const taskId = payload.taskId;
        if (!taskId) {
          await removeAiJobsFromQueue(userId, [job.id]);
          return;
        }

        const task = await getTask(userId, taskId);
        if (!task) {
          await removeAiJobsFromQueue(userId, [job.id]);
          return;
        }

        // Only already-analyzed context items are eligible candidates
        const allItems = await getContextItems(userId);
        const analyzedCandidates = allItems
          .filter((item) => item.aiState === "analyzed" && item.aiSummary)
          .map((item) => ({
            id: item.id,
            title: item.title,
            summary: item.aiSummary!,
          }));

        if (analyzedCandidates.length > 0) {
          const res = await vertexClient.suggestRelatedContext(
            task.title,
            task.description,
            analyzedCandidates
          );

          if (res.relatedContextIds && res.relatedContextIds.length > 0) {
            for (const cId of res.relatedContextIds) {
              await relateContextToTask(userId, cId, task.id);
            }
          }
        }

        await incrementAiDailyUsage(userId);
        await removeAiJobsFromQueue(userId, [job.id]);
        break;
      }

      case "build_daily_plan": {
        await vertexClient.buildDailyPlan(payload.tasks || [], payload.profile || {});
        await incrementAiDailyUsage(userId);
        await removeAiJobsFromQueue(userId, [job.id]);
        break;
      }

      default:
        await removeAiJobsFromQueue(userId, [job.id]);
        break;
    }
  } catch (err) {
    console.warn(`[AiWorker] Job ${job.id} failed:`, err);
    const attempts = (job.attempts || 0) + 1;

    if (attempts >= MAX_AI_ATTEMPTS) {
      // Retry budget exhausted -> mark target as unavailable and remove job
      if (payload.contextId) {
        await updateContextItem(userId, payload.contextId, {
          aiState: "unavailable",
        });
      }
      await removeAiJobsFromQueue(userId, [job.id]);
    } else {
      // Increment attempt counter for next drain cycle
      await incrementAiJobAttempts(userId, job.id);
    }
  }
}
