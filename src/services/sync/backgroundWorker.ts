/**
 * Background Worker boundary.
 *
 * This is a thin foreground wrapper around the sync drain.
 * It gets the current authenticated user id and calls syncContext(userId).
 *
 * OS-level native background scheduling (expo-task-manager / expo-background-fetch)
 * is intentionally NOT wired in this phase. Those APIs require native module
 * registration in app.json and a fresh prebuild — that is a separate, explicit
 * decision deferred to when we have a real production need for it.
 *
 * For now: foreground debounced sync (triggered on every mutation + on AppState
 * foreground) is the primary sync mechanism and is sufficient for this phase.
 */

import { syncContext } from "./contextSync";
import { supabase } from "@/auth/supabase";

/**
 * Drain the sync queue for the currently authenticated user.
 * Safe to call from any foreground context (app startup, AppState active, etc.)
 */
export async function runBackgroundSync(): Promise<void> {
  try {
    const { data } = await supabase?.auth.getSession() ?? { data: null };
    const userId = data?.session?.user?.id;
    if (!userId) return; // Not authenticated — nothing to sync.

    await syncContext(userId);
  } catch (err) {
    console.warn("[BackgroundWorker] Sync failed:", err);
  }
}
