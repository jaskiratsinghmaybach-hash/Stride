import type { TaskPriority } from "@/types/task";

export type PendingTaskSuggestion = {
  id: string;
  title: string;
  details?: string;
  project?: string;
  dueDate?: string;
  priority: TaskPriority;
  contextId?: string;
};

type Listener = (items: PendingTaskSuggestion[]) => void;

let items: PendingTaskSuggestion[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) {
    listener(items);
  }
}

export function getPendingSuggestions(): PendingTaskSuggestion[] {
  return items;
}

export function subscribePendingSuggestions(listener: Listener): () => void {
  listeners.add(listener);
  listener(items);
  return () => {
    listeners.delete(listener);
  };
}

export function addPendingSuggestions(next: PendingTaskSuggestion[]): void {
  if (!next.length) return;
  items = [...next, ...items];
  emit();
}

export function removePendingSuggestion(id: string): void {
  items = items.filter((item) => item.id !== id);
  emit();
}
