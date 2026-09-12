import * as FileSystem from "expo-file-system";
import type { ContextItem, ContextItemType } from "@/types/contextItem";
import { createContextItem, updateContextItem } from "./vaultClient";
import { enqueueAiJob } from "../ai/aiClient";
import { copyIntoVaultStorage, prepareImageForAi } from "./fileTypeUtils";

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
  let uri = input.uri;
  if (uri) {
    uri = await copyIntoVaultStorage(uri, input.title);
  }

  const item = await createContextItem(userId, {
    title: input.title,
    type: input.type,
    uri,
    mimeType: input.mimeType,
    notes: input.notes,
    projectId: input.projectId,
    aiState: "not_indexed",
  });

  runExtractionAndQueue(userId, item).catch((err) => {
    console.warn("[Indexing] Background extraction failed", err);
  });

  return item;
}

export async function enqueueUnderstandImageJob(
  userId: string,
  item: ContextItem
): Promise<void> {
  if (!item.uri) {
    throw new Error("Image has no local URI");
  }

  const prepared = await prepareImageForAi(item.uri, item.mimeType);
  await enqueueAiJob(userId, {
    id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: "understand_image",
    priority: "normal",
    payload: {
      contextId: item.id,
      uri: item.uri,
      title: item.title,
      imageBase64: prepared.imageBase64,
      mimeType: prepared.mimeType,
    },
  });
}

async function runExtractionAndQueue(userId: string, item: ContextItem): Promise<void> {
  try {
    let extractedText: string | undefined = undefined;

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
    } else if (item.notes) {
      extractedText = item.notes;
    }

    await updateContextItem(userId, item.id, {
      extractedText,
      aiState: "analyzing",
    });

    if (item.type === "image") {
      try {
        await enqueueUnderstandImageJob(userId, item);
      } catch (imgErr) {
        console.warn("[Indexing] Image bytes unavailable for AI", imgErr);
        await updateContextItem(userId, item.id, { aiState: "unavailable" });
      }
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
