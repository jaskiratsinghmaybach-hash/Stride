export type TaskStatus = "inbox" | "planned" | "in_progress" | "completed" | "archived";

export type TaskPriority = "low" | "normal" | "high";

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string; // ISO
  estimatedMinutes?: number;
  projectId?: string;
  source?: string;
  createdAt: string; // ISO
  completedAt?: string; // ISO
  relatedContextIds?: string[];
};
