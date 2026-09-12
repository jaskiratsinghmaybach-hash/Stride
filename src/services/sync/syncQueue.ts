/**
 * STRIDE Sync Queue
 *
 * A tiny durable outbox queue stored in AsyncStorage.
 * Every mutation that should be mirrored to Supabase writes a SyncQueueEntry here,
 * then the drain process (contextSync.ts) batches and sends them.
 *
 * UI actions NEVER wait on this — local AsyncStorage is updated first and returned
 * to the caller immediately. This file only manages queue bookkeeping.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export type SyncOp = "upsert" | "delete";

export type SyncEntity = "task" | "project" | "context_item" | "focus_session";

export type SyncQueueEntry = {
  id: string;       // queue entry id (not the entity id)
  entity: SyncEntity;
  op: SyncOp;
  entityId: string; // the task/project/etc id
  payload?: unknown; // full record for upsert, omitted for delete
  enqueuedAt: string; // ISO
  attempts: number;
};

function getSyncQueueKey(userId: string): string {
  return `stride.sync_queue.${userId}`;
}

export async function getQueue(userId: string): Promise<SyncQueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(getSyncQueueKey(userId));
    if (!raw) return [];
    const entries: SyncQueueEntry[] = JSON.parse(raw);
    return Array.isArray(entries) ? entries : [];
  } catch (err) {
    console.warn("[SyncQueue] Failed to read queue", err);
    return [];
  }
}

export async function enqueueSync(
  userId: string,
  entry: Omit<SyncQueueEntry, "id" | "enqueuedAt" | "attempts">
): Promise<void> {
  try {
    const queue = await getQueue(userId);

    // Deduplicate: if a pending upsert already exists for the same entity,
    // replace its payload with the latest version rather than stacking entries.
    if (entry.op === "upsert") {
      const existingIndex = queue.findIndex(
        (e) => e.entity === entry.entity && e.entityId === entry.entityId && e.op === "upsert"
      );
      if (existingIndex !== -1) {
        queue[existingIndex].payload = entry.payload;
        queue[existingIndex].enqueuedAt = new Date().toISOString();
        await AsyncStorage.setItem(getSyncQueueKey(userId), JSON.stringify(queue));
        return;
      }
    }

    // For deletes: remove any pending upsert for the same entity (it's gone now).
    if (entry.op === "delete") {
      const filtered = queue.filter(
        (e) => !(e.entity === entry.entity && e.entityId === entry.entityId && e.op === "upsert")
      );
      const deleteEntry: SyncQueueEntry = {
        id: `sq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        enqueuedAt: new Date().toISOString(),
        attempts: 0,
        ...entry,
      };
      filtered.push(deleteEntry);
      await AsyncStorage.setItem(getSyncQueueKey(userId), JSON.stringify(filtered));
      return;
    }

    const newEntry: SyncQueueEntry = {
      id: `sq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
      ...entry,
    };
    queue.push(newEntry);
    await AsyncStorage.setItem(getSyncQueueKey(userId), JSON.stringify(queue));
  } catch (err) {
    // Queue write errors must NEVER surface to the caller — local write already succeeded.
    console.warn("[SyncQueue] Failed to enqueue sync entry", err);
  }
}

export async function removeFromQueue(userId: string, entryIds: string[]): Promise<void> {
  try {
    const queue = await getQueue(userId);
    const idSet = new Set(entryIds);
    const next = queue.filter((e) => !idSet.has(e.id));
    await AsyncStorage.setItem(getSyncQueueKey(userId), JSON.stringify(next));
  } catch (err) {
    console.warn("[SyncQueue] Failed to remove entries", err);
  }
}

export async function incrementAttempts(userId: string, entryId: string): Promise<void> {
  try {
    const queue = await getQueue(userId);
    const index = queue.findIndex((e) => e.id === entryId);
    if (index === -1) return;
    queue[index].attempts += 1;
    await AsyncStorage.setItem(getSyncQueueKey(userId), JSON.stringify(queue));
  } catch (err) {
    console.warn("[SyncQueue] Failed to increment attempts", err);
  }
}
