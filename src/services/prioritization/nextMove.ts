import type { Task } from "@/types/task";
import type { NextMoveResult, Prioritizer, UserRhythm } from "./types";

export class DeterministicPrioritizer implements Prioritizer {
  getNextMove(tasks: Task[], now: Date = new Date(), userRhythm?: UserRhythm): NextMoveResult {
    // Filter to active/eligible tasks
    const eligible = tasks.filter(
      (t) => t.status !== "completed" && t.status !== "archived"
    );

    if (eligible.length === 0) {
      return null;
    }

    const scored = eligible.map((task) => {
      let score = 0;
      const reasons: string[] = [];

      // 1. Resume bias (in_progress)
      if (task.status === "in_progress") {
        score += 35;
        reasons.push("Already in progress");
      } else if (task.status === "planned") {
        score += 10;
      }

      // 2. Priority weight
      if (task.priority === "high") {
        score += 30;
        reasons.push("High priority");
      } else if (task.priority === "normal") {
        score += 15;
      } else {
        score += 5;
      }

      // 3. Due-date proximity
      if (task.dueDate) {
        const due = new Date(task.dueDate);
        if (!isNaN(due.getTime())) {
          const diffMs = due.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          if (diffHours < 0) {
            score += 40;
            reasons.push("Past due date");
          } else if (diffHours <= 24) {
            score += 25;
            reasons.push("Due within 24h");
          } else if (diffHours <= 48) {
            score += 15;
            reasons.push("Due soon");
          }
        }
      }

      // 4. Estimated duration vs day rhythm window
      if (userRhythm?.dayEnd) {
        const remainingMinutes = getRemainingMinutesInDay(userRhythm.dayEnd, now);
        if (remainingMinutes > 0 && task.estimatedMinutes) {
          if (task.estimatedMinutes <= remainingMinutes) {
            score += 10;
            reasons.push(`Fits remaining day window (~${task.estimatedMinutes}m)`);
          } else {
            score -= 10;
          }
        }
      }

      // 5. Tie breaker: creation age
      const createdTime = new Date(task.createdAt).getTime();
      if (!isNaN(createdTime)) {
        const ageHours = (now.getTime() - createdTime) / (1000 * 60 * 60);
        score += Math.min(5, Math.floor(ageHours / 12));
      }

      const reason =
        reasons.length > 0
          ? reasons.slice(0, 2).join(" · ")
          : "Next planned item for your focus";

      const confidence = Math.min(0.98, Math.max(0.65, 0.65 + score / 200));

      return { task, score, reason, confidence };
    });

    scored.sort((a, b) => b.score - a.score);

    const winner = scored[0];
    return {
      task: winner.task,
      reason: winner.reason,
      confidence: Number(winner.confidence.toFixed(2)),
    };
  }
}

function getRemainingMinutesInDay(dayEndString: string, now: Date): number {
  try {
    const [endHours, endMinutes] = dayEndString.split(":").map(Number);
    if (isNaN(endHours) || isNaN(endMinutes)) return 180;

    const end = new Date(now);
    end.setHours(endHours, endMinutes, 0, 0);

    const diffMinutes = Math.floor((end.getTime() - now.getTime()) / (1000 * 60));
    return Math.max(0, diffMinutes);
  } catch {
    return 180;
  }
}

export const deterministicPrioritizer = new DeterministicPrioritizer();
