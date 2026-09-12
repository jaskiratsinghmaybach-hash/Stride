import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ContextItem, ContextItemType } from "@/types/contextItem";
import type { Project } from "@/types/project";
import { enqueueSync } from "../sync/syncQueue";
import { scheduleDebouncedSync } from "../sync/contextSync";

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

  enqueueSync(userId, {
    entity: "project",
    op: "upsert",
    entityId: newProject.id,
    payload: newProject,
  }).then(() => scheduleDebouncedSync(userId)).catch(() => {});

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

  enqueueSync(userId, {
    entity: "context_item",
    op: "upsert",
    entityId: newItem.id,
    payload: newItem,
  }).then(() => scheduleDebouncedSync(userId)).catch(() => {});

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

  enqueueSync(userId, {
    entity: "context_item",
    op: "upsert",
    entityId: updated.id,
    payload: updated,
  }).then(() => scheduleDebouncedSync(userId)).catch(() => {});

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

export async function relateContextToProject(
  userId: string,
  contextId: string,
  projectId: string
): Promise<ContextItem | null> {
  return updateContextItem(userId, contextId, { projectId });
}

export async function deleteContextItem(userId: string, id: string): Promise<boolean> {
  const items = await getContextItems(userId);
  const target = items.find((item) => item.id === id);
  if (!target) return false;

  const next = items.filter((item) => item.id !== id);
  await AsyncStorage.setItem(getContextItemsKey(userId), JSON.stringify(next));

  const { getTasks, updateTask } = await import("../tasks/taskClient");
  const { deleteOwnedFile } = await import("./fileTypeUtils");

  const tasks = await getTasks(userId);
  for (const task of tasks) {
    if (task.relatedContextIds?.includes(id)) {
      await updateTask(userId, task.id, {
        relatedContextIds: task.relatedContextIds.filter((cid) => cid !== id),
      });
    }
  }

  await deleteOwnedFile(target.uri);

  enqueueSync(userId, {
    entity: "context_item",
    op: "delete",
    entityId: id,
  }).then(() => scheduleDebouncedSync(userId)).catch(() => {});

  return true;
}

export async function relateContextToTask(
  userId: string,
  contextId: string,
  taskId: string
): Promise<{ context: ContextItem | null; task: import("@/types/task").Task | null }> {
  const { getTask, updateTask } = await import("../tasks/taskClient");

  const [contextItem, task] = await Promise.all([
    getContextItem(userId, contextId),
    getTask(userId, taskId),
  ]);

  let updatedContext = contextItem;
  let updatedTask = task;

  if (contextItem) {
    const existingTasks = contextItem.relatedTaskIds || [];
    if (!existingTasks.includes(taskId)) {
      updatedContext = await updateContextItem(userId, contextId, {
        relatedTaskIds: [...existingTasks, taskId],
      });
    }

  }

  if (task) {
    const existingContexts = task.relatedContextIds || [];
    if (!existingContexts.includes(contextId)) {
      updatedTask = await updateTask(userId, taskId, {
        relatedContextIds: [...existingContexts, contextId],
      });
    }
  }

  return { context: updatedContext, task: updatedTask };
}

export async function unlinkContextFromTask(
  userId: string,
  contextId: string,
  taskId: string
): Promise<void> {
  const { getTask, updateTask } = await import("../tasks/taskClient");
  const task = await getTask(userId, taskId);
  if (task?.relatedContextIds?.includes(contextId)) {
    await updateTask(userId, taskId, {
      relatedContextIds: task.relatedContextIds.filter((id) => id !== contextId),
    });
  }
}
