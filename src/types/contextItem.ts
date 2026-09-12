export type ContextItemType = "document" | "image" | "note" | "file";

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
  uri?: string;
  mimeType?: string;
  notes?: string;
};
