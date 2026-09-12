import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Tabs } from "expo-router";
import { GlassTabBar } from "@/components/navigation/GlassTabBar";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import { useAuth } from "@/auth/AuthProvider";
import { hydrateFromRemote, syncContext } from "@/services/sync/contextSync";

export default function TabLayout() {
  const { colors } = useStrideTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;

  // Hydrate from Supabase once per session, on first mount after auth resolves.
  // This is the cross-device restore path: if local storage is empty on a new device,
  // existing remote data will be merged in before screens render.
  useEffect(() => {
    if (!userId) return;
    hydrateFromRemote(userId).catch((err) =>
      console.warn("[TabLayout] Hydration failed", err)
    );
    // Also flush any outbox entries that accumulated during a previous offline session.
    syncContext(userId).catch((err) =>
      console.warn("[TabLayout] Initial sync flush failed", err)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // Only re-run when the userId changes (i.e., a different account logs in).

  // Drain the outbox on every foreground transition.
  useEffect(() => {
    if (!userId) return;
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") {
          syncContext(userId).catch(() => {});
        }
      }
    );
    return () => subscription.remove();
  }, [userId]);

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        animation: "none",
        lazy: false,
        freezeOnBlur: true,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="vault" options={{ title: "Vault" }} />
      <Tabs.Screen name="focus" options={{ title: "Focus" }} />
      <Tabs.Screen name="progress" options={{ title: "Progress" }} />
    </Tabs>
  );
}
