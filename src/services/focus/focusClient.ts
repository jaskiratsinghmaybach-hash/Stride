import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FocusSession } from "@/types/focus";
import { completeTask, updateTask } from "../tasks/taskClient";

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

  // TODO: Mirror to Supabase focus_sessions table when online
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
  return session;
}
