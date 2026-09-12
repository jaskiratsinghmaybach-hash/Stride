import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TaskPriority } from "@/types/task";

export type PendingTaskSuggestion = {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate?: string;
  projectId?: string;
  createdAt: string;
};

function key(userId: string) {
  return `stride.task_suggestions.${userId}`;
}

export async function getTaskSuggestions(userId: string): Promise<PendingTaskSuggestion[]> {
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addTaskSuggestions(userId: string, suggestions: PendingTaskSuggestion[]) {
  const current = await getTaskSuggestions(userId);
  await AsyncStorage.setItem(key(userId), JSON.stringify([...suggestions, ...current]));
}

export async function removeTaskSuggestion(userId: string, id: string) {
  const current = await getTaskSuggestions(userId);
  await AsyncStorage.setItem(key(userId), JSON.stringify(current.filter((item) => item.id !== id)));
}
