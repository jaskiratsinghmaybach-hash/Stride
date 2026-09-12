import type { Task } from "@/types/task";
import type { Project } from "@/types/project";
import type { ContextItem } from "@/types/contextItem";
import { getTasks } from "../tasks/taskClient";
import { getProjects, getContextItems } from "../vault/vaultClient";

export type SearchResults = {
  tasks: Task[];
  projects: Project[];
  contextItems: ContextItem[];
};

export async function searchLocalStride(
  userId: string,
  query: string
): Promise<SearchResults> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return { tasks: [], projects: [], contextItems: [] };
  }

  const [allTasks, allProjects, allContextItems] = await Promise.all([
    getTasks(userId),
    getProjects(userId),
    getContextItems(userId),
  ]);

  const matchingTasks = allTasks.filter(
    (t) =>
      t.title.toLowerCase().includes(cleanQuery) ||
      (t.description && t.description.toLowerCase().includes(cleanQuery))
  );

  const matchingProjects = allProjects.filter((p) =>
    p.name.toLowerCase().includes(cleanQuery)
  );

  const matchingContextItems = allContextItems.filter(
    (c) =>
      c.title.toLowerCase().includes(cleanQuery) ||
      (c.notes && c.notes.toLowerCase().includes(cleanQuery)) ||
      (c.aiSummary && c.aiSummary.toLowerCase().includes(cleanQuery))
  );

  return {
    tasks: matchingTasks,
    projects: matchingProjects,
    contextItems: matchingContextItems,
  };
}

/**
 * Future Upgrade Seam: Semantic Vector Search
 * When local/hybrid embeddings are ready, this function will query the embedding index
 * rather than simple substring matching.
 */
export async function searchSemanticStride(
  userId: string,
  query: string
): Promise<SearchResults> {
  // TODO: implement vector embedding distance search
  return searchLocalStride(userId, query);
}
