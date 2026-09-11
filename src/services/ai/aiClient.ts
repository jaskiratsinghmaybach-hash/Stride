/**
 * AI boundary for STRIDE.
 *
 * Important architecture rule:
 * Do not call Gemini for every phone event.
 * Local indexing/classification happens first. Only meaningful reasoning
 * jobs should enter the AI queue.
 */

export type AiJobType =
  | "understand_document"
  | "understand_image"
  | "extract_actions"
  | "build_daily_plan"
  | "connect_context";

export type AiJob = {
  id: string;
  type: AiJobType;
  priority: "low" | "normal" | "high";
  payload: unknown;
};

export async function enqueueAiJob(_job: AiJob): Promise<void> {
  // TODO: persist to the local AI queue.
  // The worker will batch/debounce meaningful jobs before calling Gemini.
}
