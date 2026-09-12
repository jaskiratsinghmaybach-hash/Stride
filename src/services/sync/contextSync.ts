/**
 * STRIDE Context Sync — Queue Drain + Remote Hydration
 *
 * Architecture:
 * - Local AsyncStorage is the primary store. Supabase is a mirror.
 * - UI actions never await this file. They enqueue a SyncQueueEntry and return.
 * - This module drains the queue in batches via Supabase upsert/delete,
 *   with retries, backoff, and deduplication built into the queue.
 * - A module-level debounce (2s) fires syncContext() after the last enqueue.
 * - On login and on AppState foreground, syncContext() is called once to flush
 *   anything queued from a previous offline session.
 */

import { supabase, supabaseConfigured } from "@/auth/supabase";
import { getQueue, removeFromQueue, incrementAttempts, type SyncQueueEntry } from "./syncQueue";

// --- Types matching exact Supabase DB column names ---

type DbTask = {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  due_date?: string | null;
  estimated_minutes?: number | null;
  project_id?: string | null;
  source?: string | null;
  created_at: string;
  completed_at?: string | null;
  related_context_ids?: string[] | null;
};

type DbProject = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

type DbContextItem = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  created_at: string;
  project_id?: string | null;
  related_task_ids?: string[] | null;
  ai_state: string;
  ai_summary?: string | null;
  uri?: string | null;
  mime_type?: string | null;
  notes?: string | null;
};

type DbFocusSession = {
  id: string;
  user_id: string;
  task_id: string;
  started_at: string;
  ended_at?: string | null;
  duration_seconds: number;
  status: string;
};

// --- Mappers: local TS shape → DB snake_case row ---

function taskToDb(userId: string, payload: unknown): DbTask {
  const t = payload as Record<string, unknown>;
  return {
    id: t["id"] as string,
    user_id: userId,
    title: t["title"] as string,
    description: (t["description"] as string | undefined) ?? null,
    status: t["status"] as string,
    priority: t["priority"] as string,
    due_date: (t["dueDate"] as string | undefined) ?? null,
    estimated_minutes: (t["estimatedMinutes"] as number | undefined) ?? null,
    project_id: (t["projectId"] as string | undefined) ?? null,
    source: (t["source"] as string | undefined) ?? null,
    created_at: t["createdAt"] as string,
    completed_at: (t["completedAt"] as string | undefined) ?? null,
    related_context_ids: (t["relatedContextIds"] as string[] | undefined) ?? null,
  };
}

function projectToDb(userId: string, payload: unknown): DbProject {
  const p = payload as Record<string, unknown>;
  return {
    id: p["id"] as string,
    user_id: userId,
    name: p["name"] as string,
    created_at: p["createdAt"] as string,
  };
}

function contextItemToDb(userId: string, payload: unknown): DbContextItem {
  const c = payload as Record<string, unknown>;
  return {
    id: c["id"] as string,
    user_id: userId,
    type: c["type"] as string,
    title: c["title"] as string,
    created_at: c["createdAt"] as string,
    project_id: (c["projectId"] as string | undefined) ?? null,
    related_task_ids: (c["relatedTaskIds"] as string[] | undefined) ?? null,
    ai_state: c["aiState"] as string,
    ai_summary: (c["aiSummary"] as string | undefined) ?? null,
    uri: (c["uri"] as string | undefined) ?? null,
    mime_type: (c["mimeType"] as string | undefined) ?? null,
    notes: (c["notes"] as string | undefined) ?? null,
  };
}

function focusSessionToDb(userId: string, payload: unknown): DbFocusSession {
  const f = payload as Record<string, unknown>;
  return {
    id: f["id"] as string,
    user_id: userId,
    task_id: f["taskId"] as string,
    started_at: f["startedAt"] as string,
    ended_at: (f["endedAt"] as string | undefined) ?? null,
    duration_seconds: (f["durationSeconds"] as number) ?? 0,
    status: f["status"] as string,
  };
}

// --- Reverse mappers: DB row → local TS shape ---

function dbToTask(row: DbTask): Record<string, unknown> {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date ?? undefined,
    estimatedMinutes: row.estimated_minutes ?? undefined,
    projectId: row.project_id ?? undefined,
    source: row.source ?? undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    relatedContextIds: row.related_context_ids ?? undefined,
  };
}

function dbToProject(row: DbProject): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function dbToContextItem(row: DbContextItem): Record<string, unknown> {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    createdAt: row.created_at,
    projectId: row.project_id ?? undefined,
    relatedTaskIds: row.related_task_ids ?? undefined,
    aiState: row.ai_state,
    aiSummary: row.ai_summary ?? undefined,
    uri: row.uri ?? undefined,
    mimeType: row.mime_type ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function dbToFocusSession(row: DbFocusSession): Record<string, unknown> {
  return {
    id: row.id,
    taskId: row.task_id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    durationSeconds: row.duration_seconds,
    status: row.status,
  };
}

// --- Max retry cap ---
const MAX_SYNC_ATTEMPTS = 5;

// --- Debounce state ---
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 2500;

/**
 * Schedule a debounced drain. Called by enqueueSync wrappers after each
 * local write so the queue is flushed shortly after user activity settles.
 */
export function scheduleDebouncedSync(userId: string): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    syncContext(userId).catch((err) =>
      console.warn("[Sync] Debounced drain failed", err)
    );
  }, DEBOUNCE_MS);
}

/**
 * Main queue drain. Reads the outbox, batches upserts/deletes per table,
 * and syncs to Supabase. Safe to call at any time — returns immediately
 * if Supabase is not configured or the queue is empty.
 */
export async function syncContext(userId: string): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    // Running offline or env not set — this is fully expected and fine.
    return;
  }

  const queue = await getQueue(userId);
  if (queue.length === 0) return;

  // Only process entries that haven't exhausted their retry budget.
  const eligible = queue.filter((e) => e.attempts < MAX_SYNC_ATTEMPTS);
  if (eligible.length === 0) return;

  // Group eligible entries by entity type and op.
  const byTable: Record<SyncQueueEntry["entity"], { upserts: SyncQueueEntry[]; deletes: SyncQueueEntry[] }> = {
    task: { upserts: [], deletes: [] },
    project: { upserts: [], deletes: [] },
    context_item: { upserts: [], deletes: [] },
    focus_session: { upserts: [], deletes: [] },
  };

  for (const entry of eligible) {
    if (entry.op === "upsert") {
      byTable[entry.entity].upserts.push(entry);
    } else {
      byTable[entry.entity].deletes.push(entry);
    }
  }

  const succeeded: string[] = [];

  // --- Process tasks ---
  if (byTable.task.upserts.length > 0) {
    const rows = byTable.task.upserts.map((e) => taskToDb(userId, e.payload));
    const { error } = await supabase.from("tasks").upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn("[Sync] tasks upsert failed:", error.message);
      for (const e of byTable.task.upserts) {
        await incrementAttempts(userId, e.id);
      }
    } else {
      succeeded.push(...byTable.task.upserts.map((e) => e.id));
    }
  }

  for (const entry of byTable.task.deletes) {
    const { error } = await supabase.from("tasks").delete().eq("id", entry.entityId).eq("user_id", userId);
    if (error) {
      console.warn("[Sync] task delete failed:", error.message);
      await incrementAttempts(userId, entry.id);
    } else {
      succeeded.push(entry.id);
    }
  }

  // --- Process projects ---
  if (byTable.project.upserts.length > 0) {
    const rows = byTable.project.upserts.map((e) => projectToDb(userId, e.payload));
    const { error } = await supabase.from("projects").upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn("[Sync] projects upsert failed:", error.message);
      for (const e of byTable.project.upserts) {
        await incrementAttempts(userId, e.id);
      }
    } else {
      succeeded.push(...byTable.project.upserts.map((e) => e.id));
    }
  }

  for (const entry of byTable.project.deletes) {
    const { error } = await supabase.from("projects").delete().eq("id", entry.entityId).eq("user_id", userId);
    if (error) {
      console.warn("[Sync] project delete failed:", error.message);
      await incrementAttempts(userId, entry.id);
    } else {
      succeeded.push(entry.id);
    }
  }

  // --- Process context items ---
  if (byTable.context_item.upserts.length > 0) {
    const rows = byTable.context_item.upserts.map((e) => contextItemToDb(userId, e.payload));
    const { error } = await supabase.from("context_items").upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn("[Sync] context_items upsert failed:", error.message);
      for (const e of byTable.context_item.upserts) {
        await incrementAttempts(userId, e.id);
      }
    } else {
      succeeded.push(...byTable.context_item.upserts.map((e) => e.id));
    }
  }

  for (const entry of byTable.context_item.deletes) {
    const { error } = await supabase.from("context_items").delete().eq("id", entry.entityId).eq("user_id", userId);
    if (error) {
      console.warn("[Sync] context_item delete failed:", error.message);
      await incrementAttempts(userId, entry.id);
    } else {
      succeeded.push(entry.id);
    }
  }

  // --- Process focus sessions ---
  if (byTable.focus_session.upserts.length > 0) {
    const rows = byTable.focus_session.upserts.map((e) => focusSessionToDb(userId, e.payload));
    const { error } = await supabase.from("focus_sessions").upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn("[Sync] focus_sessions upsert failed:", error.message);
      for (const e of byTable.focus_session.upserts) {
        await incrementAttempts(userId, e.id);
      }
    } else {
      succeeded.push(...byTable.focus_session.upserts.map((e) => e.id));
    }
  }

  // Remove all successfully synced entries.
  if (succeeded.length > 0) {
    await removeFromQueue(userId, succeeded);
  }
}

/**
 * Pull existing Supabase rows for this user and hydrate AsyncStorage.
 * Called once per auth session on first mount when local data is empty,
 * or to merge newer remote records with local ones.
 *
 * Merge strategy: prefer whichever record is newer by createdAt / completedAt.
 * Local records that are already present are kept if they are not older than the remote.
 */
export async function hydrateFromRemote(userId: string): Promise<void> {
  if (!supabaseConfigured || !supabase) return;

  try {
    // Fetch all four tables in parallel.
    const [
      { data: remoteTasks, error: tasksError },
      { data: remoteProjects, error: projectsError },
      { data: remoteContextItems, error: contextError },
      { data: remoteFocusSessions, error: focusError },
    ] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", userId),
      supabase.from("projects").select("*").eq("user_id", userId),
      supabase.from("context_items").select("*").eq("user_id", userId),
      supabase.from("focus_sessions").select("*").eq("user_id", userId),
    ]);

    if (tasksError) console.warn("[Hydrate] tasks fetch error:", tasksError.message);
    if (projectsError) console.warn("[Hydrate] projects fetch error:", projectsError.message);
    if (contextError) console.warn("[Hydrate] context_items fetch error:", contextError.message);
    if (focusError) console.warn("[Hydrate] focus_sessions fetch error:", focusError.message);

    // Merge tasks
    if (remoteTasks && remoteTasks.length > 0) {
      await mergeLocalList(
        `stride.tasks.${userId}`,
        remoteTasks.map((r) => dbToTask(r as DbTask)),
        "createdAt"
      );
    }

    // Merge projects
    if (remoteProjects && remoteProjects.length > 0) {
      await mergeLocalList(
        `stride.projects.${userId}`,
        remoteProjects.map((r) => dbToProject(r as DbProject)),
        "createdAt"
      );
    }

    // Merge context items
    if (remoteContextItems && remoteContextItems.length > 0) {
      await mergeLocalList(
        `stride.context_items.${userId}`,
        remoteContextItems.map((r) => dbToContextItem(r as DbContextItem)),
        "createdAt"
      );
    }

    // Merge focus sessions
    if (remoteFocusSessions && remoteFocusSessions.length > 0) {
      await mergeLocalList(
        `stride.focus_sessions.${userId}`,
        remoteFocusSessions.map((r) => dbToFocusSession(r as DbFocusSession)),
        "startedAt"
      );
    }
  } catch (err) {
    console.warn("[Hydrate] Unexpected error during hydration:", err);
  }
}

/**
 * Merge remote records into a local AsyncStorage list.
 * Prefer the newer record when the same id exists in both local and remote.
 * New remote-only records are appended.
 * Local-only records (not in remote) are preserved as-is.
 */
async function mergeLocalList(
  storageKey: string,
  remoteRecords: Record<string, unknown>[],
  timestampField: string
): Promise<void> {
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;

  let localRecords: Record<string, unknown>[] = [];
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      localRecords = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    localRecords = [];
  }

  const localById = new Map<string, Record<string, unknown>>();
  for (const rec of localRecords) {
    localById.set(rec["id"] as string, rec);
  }

  for (const remote of remoteRecords) {
    const id = remote["id"] as string;
    const existing = localById.get(id);
    if (!existing) {
      // New record from remote — add it.
      localById.set(id, remote);
    } else {
      // Both exist — keep whichever has the later timestamp.
      const localTime = parseTimestamp(existing[timestampField] as string | undefined);
      const remoteTime = parseTimestamp(remote[timestampField] as string | undefined);
      if (remoteTime > localTime) {
        localById.set(id, remote);
      }
      // else keep local — it's newer or equal
    }
  }

  const merged = Array.from(localById.values());
  await AsyncStorage.setItem(storageKey, JSON.stringify(merged));
}

function parseTimestamp(ts: string | undefined): number {
  if (!ts) return 0;
  const t = new Date(ts).getTime();
  return isNaN(t) ? 0 : t;
}
