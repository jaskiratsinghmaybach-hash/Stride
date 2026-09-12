import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Cloud,
  CloudOff,
  Crown,
  LogOut,
  RefreshCcw,
  Shield,
  User,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { StrideScrollView } from "@/components/ui/StrideScrollView";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import { useSyncStatus } from "@/hooks/useSyncStatus";

export default function SettingsScreen() {
  const { colors } = useStrideTheme();
  const { session, profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status: syncStatus, pendingCount, lastSyncedAt, retryNow } = useSyncStatus();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/onboarding");
  };

  return (
    <View className="flex-1">
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["#12162C", "#1E2248", "#2E2A60"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <StrideScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: 40,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation Header */}
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <LiquidGlass shape="pill" intensity={28}>
              <View className="h-10 w-10 items-center justify-center">
                <ArrowLeft size={18} color={colors.ink} />
              </View>
            </LiquidGlass>
          </Pressable>

          <Text className="text-xl font-bold" style={{ color: colors.ink }}>
            Settings
          </Text>
        </View>

        {/* ACCOUNT SECTION (Read-only consumption of auth state) */}
        <View className="mb-6">
          <Text
            className="mb-2.5 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            ACCOUNT
          </Text>

          <LiquidGlass shape="card">
            <View className="p-4">
              <View className="flex-row items-center gap-3.5">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-indigo-500/20">
                  <User size={22} color={colors.accent} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold" style={{ color: colors.ink }}>
                    {profile?.name || "Stride User"}
                  </Text>
                  <Text className="text-xs" style={{ color: colors.muted }}>
                    {session?.user?.email || `ID: ${session?.user?.id.slice(0, 12)}...`}
                  </Text>
                </View>
              </View>
            </View>
          </LiquidGlass>
        </View>

        {/* SUBSCRIPTION TIER LINK */}
        <View className="mb-6">
          <Pressable onPress={() => router.push("/paywall")}>
            <LiquidGlass shape="card" tone="active">
              <View className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center gap-3">
                  <Crown size={20} color={colors.accent} />
                  <View>
                    <Text className="text-sm font-semibold" style={{ color: colors.ink }}>
                      Stride Membership
                    </Text>
                    <Text className="text-xs" style={{ color: colors.muted }}>
                      Free plan · Tap to view Pro AI reasoning tiers
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color={colors.muted} />
              </View>
            </LiquidGlass>
          </Pressable>
        </View>

        {/* STRIDE PREFERENCES (Rhythm, Priorities) */}
        <View className="mb-6">
          <Text
            className="mb-2.5 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            DAILY RHYTHM & PRIORITIES
          </Text>

          <LiquidGlass shape="card">
            <View className="p-4 gap-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5">
                  <Clock size={16} color={colors.accent} />
                  <Text className="text-sm font-medium" style={{ color: colors.ink }}>
                    Day Window
                  </Text>
                </View>
                <Text className="text-xs font-semibold" style={{ color: colors.ink }}>
                  {profile?.dayStart || "08:00"} – {profile?.dayEnd || "18:00"}
                </Text>
              </View>

              <View className="border-t border-white/10 pt-3">
                <Text className="text-xs font-medium mb-2" style={{ color: colors.muted }}>
                  Active Focus Areas
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {profile?.priorities?.length ? (
                    profile.priorities.map((p, i) => (
                      <View
                        key={i}
                        className="rounded-full bg-white/10 px-3 py-1"
                      >
                        <Text className="text-xs font-medium" style={{ color: colors.ink }}>
                          {p}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text className="text-xs" style={{ color: colors.muted }}>
                      None selected during onboarding
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </LiquidGlass>
        </View>

        {/* PERMISSIONS & PRIVACY */}
        <View className="mb-6">
          <Text
            className="mb-2.5 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            SECURITY & DEVICE
          </Text>

          <Pressable onPress={() => router.push("/permissions")}>
            <LiquidGlass shape="card">
              <View className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center gap-3">
                  <Shield size={18} color={colors.accent} />
                  <View>
                    <Text className="text-sm font-medium" style={{ color: colors.ink }}>
                      Permission Center
                    </Text>
                    <Text className="text-xs" style={{ color: colors.muted }}>
                      Manage files, calendar, microphone & alerts
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color={colors.muted} />
              </View>
            </LiquidGlass>
          </Pressable>
        </View>

        {/* CLOUD SYNC STATUS — Calm, honest, never fabricates "synced" with pending entries */}
        <View className="mb-6">
          <Text
            className="mb-2.5 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            CLOUD SYNC
          </Text>

          <LiquidGlass shape="card">
            <View className="p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5">
                  {syncStatus === "offline" ? (
                    <CloudOff size={16} color={colors.muted} />
                  ) : syncStatus === "error" ? (
                    <CloudOff size={16} color={colors.spark} />
                  ) : syncStatus === "syncing" ? (
                    <RefreshCcw size={16} color={colors.accent} />
                  ) : (
                    <Cloud size={16} color={colors.accent} />
                  )}
                  <Text className="text-sm font-medium" style={{ color: colors.ink }}>
                    {syncStatus === "offline"
                      ? "Offline — changes saved on this device"
                      : syncStatus === "error"
                      ? "Sync error, will retry"
                      : syncStatus === "syncing"
                      ? `Syncing (${pendingCount} pending)...`
                      : lastSyncedAt
                      ? `Synced ${lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Ready to sync"}
                  </Text>
                </View>

                {(syncStatus === "error" || syncStatus === "syncing") && (
                  <Pressable onPress={retryNow} hitSlop={12}>
                    <Text className="text-xs font-semibold" style={{ color: colors.accent }}>
                      Retry
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </LiquidGlass>
        </View>

        {/* ABOUT & APP INFO */}
        <View className="mb-8">
          <Text
            className="mb-2.5 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            ABOUT
          </Text>

          <LiquidGlass shape="card">
            <View className="p-4 gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs" style={{ color: colors.muted }}>
                  Stride Version
                </Text>
                <Text className="text-xs font-medium" style={{ color: colors.ink }}>
                  0.2.0 (SDK 57)
                </Text>
              </View>
              <View className="flex-row items-center justify-between border-t border-white/10 pt-2">
                <Text className="text-xs" style={{ color: colors.muted }}>
                  Privacy Policy
                </Text>
                <Text className="text-xs font-medium" style={{ color: colors.accent }}>
                  Local-first
                </Text>
              </View>
              <View className="flex-row items-center justify-between border-t border-white/10 pt-2">
                <Text className="text-xs" style={{ color: colors.muted }}>
                  Terms of Service
                </Text>
                <Text className="text-xs font-medium" style={{ color: colors.accent }}>
                  Read
                </Text>
              </View>
            </View>
          </LiquidGlass>
        </View>

        {/* SIGN OUT */}
        <Pressable onPress={handleSignOut} className="mb-6">
          <LiquidGlass shape="card">
            <View className="flex-row items-center justify-center gap-2 p-3.5">
              <LogOut size={16} color={colors.spark} />
              <Text className="text-sm font-semibold" style={{ color: colors.spark }}>
                Sign Out
              </Text>
            </View>
          </LiquidGlass>
        </Pressable>
      </StrideScrollView>
    </View>
  );
}
