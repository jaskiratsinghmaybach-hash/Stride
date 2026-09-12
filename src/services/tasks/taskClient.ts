import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Task } from "@/types/task";
import { enqueueSync } from "../sync/syncQueue";
import { scheduleDebouncedSync } from "../sync/contextSync";

function getTasksStorageKey(userId: string): string {
  return `stride.tasks.${userId}`;
}

export async function getTasks(userId: string): Promise<Task[]> {
  try {
    const raw = await AsyncStorage.getItem(getTasksStorageKey(userId));
    if (!raw) return [];
    const tasks: Task[] = JSON.parse(raw);
    return Array.isArray(tasks) ? tasks : [];
  } catch (error) {
    console.warn("Failed to load tasks from local storage", error);
    return [];
  }
}

export async function getTask(userId: string, taskId: string): Promise<Task | null> {
  const tasks = await getTasks(userId);
  return tasks.find((t) => t.id === taskId) ?? null;
}

export async function createTask(
  userId: string,
  input: Omit<Task, "id" | "createdAt"> & { id?: string; createdAt?: string }
): Promise<Task> {
  const tasks = await getTasks(userId);
  const newTask: Task = {
    ...input,
    id: input.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: input.createdAt || new Date().toISOString(),
  };

  const nextTasks = [newTask, ...tasks];
  await AsyncStorage.setItem(getTasksStorageKey(userId), JSON.stringify(nextTasks));

  // Enqueue outbox entry — never awaited in a way that blocks the local write.
  enqueueSync(userId, {
    entity: "task",
    op: "upsert",
    entityId: newTask.id,
    payload: newTask,
  }).then(() => scheduleDebouncedSync(userId)).catch(() => {});

  return newTask;
}

export async function updateTask(
  userId: string,
  taskId: string,
  updates: Partial<Task>
): Promise<Task | null> {
  const tasks = await getTasks(userId);
  const index = tasks.findIndex((t) => t.id === taskId);
  if (index === -1) return null;

  const updated: Task = {
    ...tasks[index],
    ...updates,
  };
  tasks[index] = updated;

  await AsyncStorage.setItem(getTasksStorageKey(userId), JSON.stringify(tasks));

  enqueueSync(userId, {
    entity: "task",
    op: "upsert",
    entityId: updated.id,
    payload: updated,
  }).then(() => scheduleDebouncedSync(userId)).catch(() => {});

  return updated;
}

export async function completeTask(userId: string, taskId: string): Promise<Task | null> {
  return updateTask(userId, taskId, {
    status: "completed",
    completedAt: new Date().toISOString(),
  });
}

export async function deleteTask(userId: string, taskId: string): Promise<boolean> {
  const tasks = await getTasks(userId);
  const nextTasks = tasks.filter((t) => t.id !== taskId);
  if (nextTasks.length === tasks.length) return false;

  await AsyncStorage.setItem(getTasksStorageKey(userId), JSON.stringify(nextTasks));

  enqueueSync(userId, {
    entity: "task",
    op: "delete",
    entityId: taskId,
  }).then(() => scheduleDebouncedSync(userId)).catch(() => {});

  return true;
}
