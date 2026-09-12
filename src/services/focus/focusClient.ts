import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FocusSession } from "@/types/focus";
import { completeTask, updateTask } from "../tasks/taskClient";
import { enqueueSync } from "../sync/syncQueue";
import { scheduleDebouncedSync } from "../sync/contextSync";

function getFocusSessionsKey(userId: string): string {
  return `stride.focus_sessions.${userId}`;
}

export async function getFocusSessions(userId: string): Promise<FocusSession[]> {
  try {
    const raw = await AsyncStorage.getItem(getFocusSessionsKey(userId));
    if (!raw) return [];
    const items: FocusSession[] = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.warn("Failed to load focus sessions", error);
    return [];
  }
}

export async function startFocusSession(
  userId: string,
  taskId: string
): Promise<FocusSession> {
  const sessions = await getFocusSessions(userId);
  const newSession: FocusSession = {
    id: `focus_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    taskId,
    startedAt: new Date().toISOString(),
    durationSeconds: 0,
    status: "active",
  };

  await AsyncStorage.setItem(getFocusSessionsKey(userId), JSON.stringify([newSession, ...sessions]));
  // Mark task as in_progress
  await updateTask(userId, taskId, { status: "in_progress" });

  // Enqueue sync for the new session (initial "active" state).
  enqueueSync(userId, {
    entity: "focus_session",
    op: "upsert",
    entityId: newSession.id,
    payload: newSession,
  }).then(() => scheduleDebouncedSync(userId)).catch(() => {});

  return newSession;
}

export async function recordFocusProgress(
  userId: string,
  sessionId: string,
  elapsedSeconds: number
): Promise<FocusSession | null> {
  const sessions = await getFocusSessions(userId);
  const index = sessions.findIndex((s) => s.id === sessionId);
  if (index === -1) return null;

  sessions[index].durationSeconds = elapsedSeconds;
  await AsyncStorage.setItem(getFocusSessionsKey(userId), JSON.stringify(sessions));

  // THROTTLING DECISION: No sync enqueue on progress ticks.
  //
  // recordFocusProgress fires approximately once per second while a session is active.
  // Enqueueing on every tick would flood the outbox queue with per-second entries
  // and hit Supabase with write-per-second traffic. The enqueueSync() deduplication
  // logic does collapse repeat upserts for the same entityId, but still pays the
  // AsyncStorage read+write cost every second — unnecessary for intermediate state.
  //
  // Strategy chosen: SKIP queuing entirely here. The final state is written via
  // completeFocusSession() or abandonFocusSession(), which both enqueue with the
  // accumulated durationSeconds. The only data "lost" in a hard crash is the
  // sub-second progress delta since the last completeFocusSession() — acceptable.

  return sessions[index];
}

export async function completeFocusSession(
  userId: string,
  sessionId: string,
  totalDurationSeconds: number,
  andCompleteTask: boolean = true
): Promise<FocusSession | null> {
  const sessions = await getFocusSessions(userId);
  const index = sessions.findIndex((s) => s.id === sessionId);
  if (index === -1) return null;

  const session = sessions[index];
  session.endedAt = new Date().toISOString();
  session.durationSeconds = totalDurationSeconds;
  session.status = "completed";

  await AsyncStorage.setItem(getFocusSessionsKey(userId), JSON.stringify(sessions));

  if (andCompleteTask && session.taskId) {
    await completeTask(userId, session.taskId);
  }

  // Enqueue final state sync — replaces the "active" entry in the queue via dedup.
  enqueueSync(userId, {
    entity: "focus_session",
    op: "upsert",
    entityId: session.id,
    payload: { ...session },
  }).then(() => scheduleDebouncedSync(userId)).catch(() => {});

  return session;
}

export async function abandonFocusSession(
  userId: string,
  sessionId: string,
  durationSeconds: number
): Promise<FocusSession | null> {
  const sessions = await getFocusSessions(userId);
  const index = sessions.findIndex((s) => s.id === sessionId);
  if (index === -1) return null;

  const session = sessions[index];
  session.endedAt = new Date().toISOString();
  session.durationSeconds = durationSeconds;
  session.status = "abandoned";

  await AsyncStorage.setItem(getFocusSessionsKey(userId), JSON.stringify(sessions));

  // Enqueue final state sync — replaces the "active" entry in the queue via dedup.
  enqueueSync(userId, {
    entity: "focus_session",
    op: "upsert",
    entityId: session.id,
    payload: { ...session },
  }).then(() => scheduleDebouncedSync(userId)).catch(() => {});

  return session;
}
