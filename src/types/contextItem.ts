export type ContextItemType = "document" | "image" | "note" | "file" | "audio";

export type AiAnalysisState = "not_indexed" | "analyzing" | "analyzed" | "unavailable";

export type ContextItem = {
  id: string;
  type: ContextItemType;
  title: string;
  createdAt: string;
  projectId?: string;
  relatedTaskIds?: string[];
  aiState: AiAnalysisState;
  aiSummary?: string; // only present when aiState === "analyzed"
  extractedText?: string;
  uri?: string;
  mimeType?: string;
  notes?: string;
};

/** Map picker metadata to the shared ContextItem type. SVGs are images too. */
export function inferContextItemType(
  mimeType?: string | null,
  filename?: string | null
): ContextItemType {
  const mime = (mimeType || "").toLowerCase();
  const name = (filename || "").toLowerCase();
  if (mime.startsWith("image/") || /\.(avif|bmp|gif|jpe?g|png|svg|webp|heic|heif)$/.test(name)) {
    return "image";
  }
  return "document";
}
