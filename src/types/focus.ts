export type FocusSessionStatus = "active" | "paused" | "completed" | "abandoned";

export type FocusSession = {
  id: string;
  taskId: string;
  startedAt: string; // ISO
  endedAt?: string; // ISO
  durationSeconds: number;
  status: FocusSessionStatus;
};
