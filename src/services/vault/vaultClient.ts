import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ContextItem, ContextItemType } from "@/types/contextItem";
import type { Project } from "@/types/project";

function getProjectsKey(userId: string): string {
  return `stride.projects.${userId}`;
}

function getContextItemsKey(userId: string): string {
  return `stride.context_items.${userId}`;
}

export async function getProjects(userId: string): Promise<Project[]> {
  try {
    const raw = await AsyncStorage.getItem(getProjectsKey(userId));
    if (!raw) return [];
    const items: Project[] = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.warn("Failed to load projects from storage", error);
    return [];
  }
}

export async function createProject(userId: string, name: string): Promise<Project> {
  const projects = await getProjects(userId);
  const newProject: Project = {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };

  const next = [newProject, ...projects];
  await AsyncStorage.setItem(getProjectsKey(userId), JSON.stringify(next));
  // TODO: Mirror to Supabase projects table when online
  return newProject;
}

export async function getContextItems(
  userId: string,
  filter?: { type?: ContextItemType; projectId?: string }
): Promise<ContextItem[]> {
  try {
    const raw = await AsyncStorage.getItem(getContextItemsKey(userId));
    if (!raw) return [];
    let items: ContextItem[] = JSON.parse(raw);
    if (!Array.isArray(items)) return [];

    if (filter?.type) {
      items = items.filter((item) => item.type === filter.type);
    }
    if (filter?.projectId) {
      items = items.filter((item) => item.projectId === filter.projectId);
    }
    return items;
  } catch (error) {
    console.warn("Failed to load context items from storage", error);
    return [];
  }
}

export async function getContextItem(userId: string, id: string): Promise<ContextItem | null> {
  const items = await getContextItems(userId);
  return items.find((item) => item.id === id) ?? null;
}

export async function createContextItem(
  userId: string,
  input: Omit<ContextItem, "id" | "createdAt"> & { id?: string; createdAt?: string }
): Promise<ContextItem> {
  const items = await getContextItems(userId);
  const newItem: ContextItem = {
    ...input,
    id: input.id || `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: input.createdAt || new Date().toISOString(),
  };

  const next = [newItem, ...items];
  await AsyncStorage.setItem(getContextItemsKey(userId), JSON.stringify(next));
  // TODO: Mirror to Supabase context_items table when online
  return newItem;
}

export async function updateContextItem(
  userId: string,
  id: string,
  updates: Partial<ContextItem>
): Promise<ContextItem | null> {
  const items = await getContextItems(userId);
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const updated: ContextItem = {
    ...items[index],
    ...updates,
  };
  items[index] = updated;

  await AsyncStorage.setItem(getContextItemsKey(userId), JSON.stringify(items));
  // TODO: Mirror to Supabase context_items table when online
  return updated;
}

export async function getContextItemsByIds(
  userId: string,
  ids: string[]
): Promise<ContextItem[]> {
  if (!ids || ids.length === 0) return [];
  const set = new Set(ids);
  const items = await getContextItems(userId);
  return items.filter((item) => set.has(item.id));
}
