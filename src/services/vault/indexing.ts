import * as FileSystem from "expo-file-system";
import type { ContextItem, ContextItemType } from "@/types/contextItem";
import { createContextItem, updateContextItem } from "./vaultClient";
import { enqueueAiJob } from "../ai/aiClient";

export type AddContextInput = {
  title: string;
  type: ContextItemType;
  uri?: string;
  mimeType?: string;
  notes?: string;
  projectId?: string;
};

/**
 * Add a ContextItem instantly with aiState: 'not_indexed'
 * and trigger client-side text extraction + AI queuing asynchronously.
 */
export async function addAndIndexContextItem(
  userId: string,
  input: AddContextInput
): Promise<ContextItem> {
  // 1. Create ContextItem immediately with knowable metadata
  const item = await createContextItem(userId, {
    title: input.title,
    type: input.type,
    uri: input.uri,
    mimeType: input.mimeType,
    notes: input.notes,
    projectId: input.projectId,
    aiState: "not_indexed",
  });

  // 2. Fire indexing pipeline asynchronously without blocking the UI return
  runExtractionAndQueue(userId, item).catch((err) => {
    console.warn("[Indexing] Background extraction failed", err);
  });

  return item;
}

async function runExtractionAndQueue(userId: string, item: ContextItem): Promise<void> {
  try {
    let extractedText: string | undefined = undefined;

    // Document text extraction
    if (item.type === "document" && item.uri) {
      try {
        const isTextCandidate =
          item.uri.endsWith(".txt") ||
          item.uri.endsWith(".md") ||
          item.uri.endsWith(".json") ||
          item.uri.endsWith(".csv") ||
          (item.mimeType &&
            (item.mimeType.includes("text") || item.mimeType.includes("json")));

        if (isTextCandidate) {
          extractedText = await FileSystem.readAsStringAsync(item.uri);
        }
      } catch (readErr) {
        console.warn("[Indexing] Failed reading text document", readErr);
      }
    } else if (item.type === "note" && item.notes) {
      extractedText = item.notes;
    }

    // Update item with extracted text and transition to 'analyzing'
    const updated = await updateContextItem(userId, item.id, {
      extractedText,
      aiState: "analyzing",
    });

    // Enqueue appropriate AI job
    if (item.type === "image") {
      if (!item.uri || !item.mimeType) {
        await updateContextItem(userId, item.id, { aiState: "unavailable" });
        return;
      }
      let imageBase64: string;
      try {
        imageBase64 = await FileSystem.readAsStringAsync(item.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (error) {
        console.warn("[Indexing] Failed reading image for understanding", error);
        await updateContextItem(userId, item.id, { aiState: "unavailable" });
        return;
      }
      await enqueueAiJob(userId, {
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: "understand_image",
        priority: "normal",
        payload: {
          contextId: item.id,
          imageBase64,
          mimeType: item.mimeType,
          title: item.title,
        },
      });
    } else if (item.type === "document" || item.type === "note") {
      await enqueueAiJob(userId, {
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: "understand_document",
        priority: "normal",
        payload: {
          contextId: item.id,
          title: item.title,
          text: extractedText || item.title,
        },
      });
    }
  } catch (err) {
    console.warn("[Indexing] Failed during extraction and queuing", err);
    await updateContextItem(userId, item.id, {
      aiState: "unavailable",
    });
  }
}
