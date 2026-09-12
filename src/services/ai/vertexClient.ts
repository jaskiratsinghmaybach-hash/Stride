/**
 * Vertex AI / Gemini Client boundary for STRIDE.
 *
 * Security Tradeoff Decision:
 * Client code NEVER embeds raw service account credentials.
 * Requests route through the secure server-side proxy Supabase Edge Function (`gemini-proxy`)
 * which verifies the user's short-lived JWT and holds the Google Cloud Vertex/Gemini
 * credentials as Supabase secrets.
 *
 * If the Edge Function or network fails, typed errors are surfaced — never fabricated outputs.
 */

import { supabase, supabaseConfigured } from "@/auth/supabase";
import type { Task } from "@/types/task";

export class AiServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "NETWORK_ERROR" | "RATE_LIMIT" | "MALFORMED_RESPONSE" | "UNCONFIGURED"
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

async function invokeAiProxy<T>(action: string, payload: unknown): Promise<T> {
  if (!supabaseConfigured || !supabase) {
    throw new AiServiceError(
      "Supabase client is not configured for AI proxy",
      "UNCONFIGURED"
    );
  }

  try {
    const { data, error } = await supabase.functions.invoke("gemini-proxy", {
      body: { action, payload },
    });

    if (error) {
      if (error.message?.includes("429")) {
        throw new AiServiceError("Gemini rate limit reached", "RATE_LIMIT");
      }
      throw new AiServiceError(error.message || "AI invocation error", "NETWORK_ERROR");
    }

    if (!data || data.error) {
      throw new AiServiceError(data?.error || "AI service returned an error", "NETWORK_ERROR");
    }

    if (!data.result) {
      throw new AiServiceError("AI response missing result payload", "MALFORMED_RESPONSE");
    }

    return data.result as T;
  } catch (err: any) {
    if (err instanceof AiServiceError) throw err;
    throw new AiServiceError(err.message || "Failed to reach AI service", "NETWORK_ERROR");
  }
}

export async function understandDocument(
  text: string,
  title?: string
): Promise<{ summary: string; extractedDates?: string[] }> {
  if (!text || text.trim().length === 0) {
    throw new AiServiceError("Document content is empty", "MALFORMED_RESPONSE");
  }

  const result = await invokeAiProxy<{ summary: string; extractedDates?: string[] }>(
    "understand_document",
    { text: text.slice(0, 8000), title }
  );

  if (!result.summary) {
    throw new AiServiceError("Model did not return a summary", "MALFORMED_RESPONSE");
  }

  return result;
}

export async function understandImage(
  imageBase64: string,
  mimeType: string,
  title?: string
): Promise<{ summary: string }> {
  if (!imageBase64) {
    throw new AiServiceError("Image bytes were not provided", "MALFORMED_RESPONSE");
  }

  const result = await invokeAiProxy<{ summary: string }>("understand_image", {
    title,
    imageBase64,
    mimeType: mimeType || "image/jpeg",
  });

  if (!result.summary) {
    throw new AiServiceError("Model did not return an image summary", "MALFORMED_RESPONSE");
  }

  return result;
}

export async function extractActions(
  freeText: string
): Promise<Array<{ title: string; project?: string; dueDate?: string; priority?: "low" | "normal" | "high" }>> {
  if (!freeText || freeText.trim().length === 0) {
    return [];
  }

  const result = await invokeAiProxy<
    Array<{ title: string; project?: string; dueDate?: string; priority?: "low" | "normal" | "high" }>
  >("extract_actions", { freeText });

  if (!Array.isArray(result)) {
    throw new AiServiceError("Expected array of extracted actions", "MALFORMED_RESPONSE");
  }

  return result;
}

export async function buildDailyPlan(
  tasks: Task[],
  profile: { dayStart?: string; dayEnd?: string; priorities?: string[] }
): Promise<{ orderedTaskIds: string[]; note: string }> {
  const result = await invokeAiProxy<{ orderedTaskIds: string[]; note: string }>(
    "build_daily_plan",
    { tasks, profile }
  );

  if (!result.orderedTaskIds || !Array.isArray(result.orderedTaskIds)) {
    throw new AiServiceError("Malformed daily plan response", "MALFORMED_RESPONSE");
  }

  return result;
}

export async function suggestRelatedContext(
  taskTitle: string,
  taskDesc?: string,
  candidates?: Array<{ id: string; title: string; summary: string }>
): Promise<{ relatedContextIds: string[]; reasoning?: string }> {
  if (!candidates || candidates.length === 0) {
    return { relatedContextIds: [] };
  }

  const result = await invokeAiProxy<{ relatedContextIds: string[]; reasoning?: string }>(
    "suggest_related_context",
    { taskTitle, taskDesc, candidates }
  );

  if (!Array.isArray(result.relatedContextIds)) {
    throw new AiServiceError("Malformed related context response", "MALFORMED_RESPONSE");
  }

  return result;
}
