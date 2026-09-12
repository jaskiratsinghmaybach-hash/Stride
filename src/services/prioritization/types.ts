import type { Task } from "@/types/task";

export type NextMoveResult = {
  task: Task;
  reason: string;
  confidence: number; // 0 to 1
} | null;

export type UserRhythm = {
  dayStart?: string; // e.g. "08:00"
  dayEnd?: string;   // e.g. "18:00"
};

export interface Prioritizer {
  getNextMove(tasks: Task[], now: Date, userRhythm?: UserRhythm): NextMoveResult;
}
