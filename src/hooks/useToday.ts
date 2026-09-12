import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import type { Task } from "@/types/task";
import type { ContextItem } from "@/types/contextItem";
import { getTasks, completeTask as completeTaskService } from "@/services/tasks/taskClient";
import { getContextItems, getContextItemsByIds } from "@/services/vault/vaultClient";
import { deterministicPrioritizer } from "@/services/prioritization/nextMove";
import type { NextMoveResult } from "@/services/prioritization/types";

export type TodayData = {
  nextMove: NextMoveResult;
  upNext: Task[];
  relatedContext: ContextItem[];
  resume: Task | null;
  allTasksCount: number;
  completedTodayCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
};

export function useToday(): TodayData {
  const { session, profile } = useAuth();
  const userId = session?.user?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nextMove, setNextMove] = useState<NextMoveResult>(null);
  const [upNext, setUpNext] = useState<Task[]>([]);
  const [relatedContext, setRelatedContext] = useState<ContextItem[]>([]);
  const [resume, setResume] = useState<Task | null>(null);
  const [completedTodayCount, setCompletedTodayCount] = useState(0);

  const loadData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      const allTasks = await getTasks(userId);
      setTasks(allTasks);

      // Filter active vs completed
      const activeTasks = allTasks.filter(
        (t) => t.status !== "completed" && t.status !== "archived"
      );

      // Check today's completed tasks
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const completedToday = allTasks.filter((t) => {
        if (t.status !== "completed" || !t.completedAt) return false;
        const compDate = new Date(t.completedAt);
        return !isNaN(compDate.getTime()) && compDate >= startOfToday;
      });
      setCompletedTodayCount(completedToday.length);

      // Determine resume task (real prior activity only: status === "in_progress")
      const inProgressTask = activeTasks.find((t) => t.status === "in_progress") ?? null;
      setResume(inProgressTask);

      // Compute Next Move
      const result = deterministicPrioritizer.getNextMove(activeTasks, new Date(), {
        dayStart: profile?.dayStart,
        dayEnd: profile?.dayEnd,
      });
      setNextMove(result);

      // Compute Up Next: up to 3 tasks excluding next move
      const remainingForUpNext = activeTasks.filter(
        (t) => !result?.task || t.id !== result.task.id
      );

      // Sort remaining by priority (high > normal > low) and due date
      const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
      remainingForUpNext.sort((a, b) => {
        const pDiff = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
        if (pDiff !== 0) return pDiff;
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setUpNext(remainingForUpNext.slice(0, 3));

      // Context items related to nextMove
      if (result?.task?.relatedContextIds && result.task.relatedContextIds.length > 0) {
        const ctxItems = await getContextItemsByIds(userId, result.task.relatedContextIds);
        setRelatedContext(ctxItems);
      } else if (result?.task?.projectId) {
        const ctxItems = await getContextItems(userId, { projectId: result.task.projectId });
        setRelatedContext(ctxItems.slice(0, 3));
      } else {
        setRelatedContext([]);
      }
    } catch (err) {
      console.warn("Failed loading today data", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, profile?.dayStart, profile?.dayEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      if (!userId) return;
      await completeTaskService(userId, taskId);
      await loadData();
    },
    [userId, loadData]
  );

  return {
    nextMove,
    upNext,
    relatedContext,
    resume,
    allTasksCount: tasks.length,
    completedTodayCount,
    isLoading,
    refresh: loadData,
    completeTask: handleCompleteTask,
  };
}
