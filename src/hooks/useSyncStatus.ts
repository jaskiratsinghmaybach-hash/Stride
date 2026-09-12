import { useCallback, useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { supabaseConfigured } from "@/auth/supabase";
import { getQueue } from "@/services/sync/syncQueue";
import { syncContext } from "@/services/sync/contextSync";

export type SyncStatus = "offline" | "syncing" | "synced" | "error";

export type UseSyncStatusResult = {
  status: SyncStatus;
  pendingCount: number;
  errorCount: number;
  lastSyncedAt: Date | null;
  retryNow: () => void;
};

const MAX_SYNC_ATTEMPTS = 5;

/**
 * Exposes a calm, honest sync status for the UI.
 *
 * Rules:
 * - "offline" if supabaseConfigured is false.
 * - "syncing" when a drain is actively running.
 * - "error" when the queue has entries that have hit the retry cap.
 * - "synced" only when the queue is genuinely empty after a successful drain.
 * - Never shows "synced" if there are pending entries.
 */
export function useSyncStatus(): UseSyncStatusResult {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [status, setStatus] = useState<SyncStatus>(
    supabaseConfigured ? "synced" : "offline"
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const drain = useCallback(async () => {
    if (!userId || !supabaseConfigured) {
      setStatus("offline");
      return;
    }

    // Read queue state before drain.
    const queueBefore = await getQueue(userId);
    const errorsBefore = queueBefore.filter(
      (e) => e.attempts >= MAX_SYNC_ATTEMPTS
    );

    setPendingCount(queueBefore.length - errorsBefore.length);
    setErrorCount(errorsBefore.length);

    if (queueBefore.length === 0) {
      setStatus("synced");
      setLastSyncedAt(new Date());
      return;
    }

    if (errorsBefore.length > 0 && queueBefore.length === errorsBefore.length) {
      // All remaining entries have hit the cap — surface as error.
      setStatus("error");
      return;
    }

    setStatus("syncing");

    try {
      await syncContext(userId);

      // Re-read queue after drain.
      const queueAfter = await getQueue(userId);
      const errorsAfter = queueAfter.filter((e) => e.attempts >= MAX_SYNC_ATTEMPTS);
      setPendingCount(queueAfter.length - errorsAfter.length);
      setErrorCount(errorsAfter.length);

      if (queueAfter.length === 0) {
        setStatus("synced");
        setLastSyncedAt(new Date());
      } else if (errorsAfter.length === queueAfter.length) {
        setStatus("error");
      } else {
        // Some succeeded, some still pending — next drain will pick them up.
        setStatus("syncing");
      }
    } catch {
      setStatus("error");
    }
  }, [userId]);

  // Drain on mount (flushes any queue accumulated during offline session).
  useEffect(() => {
    drain();
  }, [drain]);

  // Drain on AppState foreground transition.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") {
          drain();
        }
      }
    );
    return () => subscription.remove();
  }, [drain]);

  const retryNow = useCallback(() => {
    drain();
  }, [drain]);

  return { status, pendingCount, errorCount, lastSyncedAt, retryNow };
}
