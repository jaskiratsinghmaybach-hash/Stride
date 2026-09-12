import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Flame,
  Lock,
  Sparkles,
  TrendingUp,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { StrideScrollView } from "@/components/ui/StrideScrollView";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import type { Task } from "@/types/task";
import type { FocusSession } from "@/types/focus";
import { getTasks } from "@/services/tasks/taskClient";
import { getFocusSessions } from "@/services/focus/focusClient";
import {
  getRewardsSummary,
  toLocalDateString,
  type RewardsSummary,
} from "@/services/rewards/rewardsEngine";

export default function ProgressScreen() {
  const { colors } = useStrideTheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = session?.user?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [activeTasksCount, setActiveTasksCount] = useState(0);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);

  const loadProgress = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    try {
      const [allTasks, sessions, rewardSummary] = await Promise.all([
        getTasks(userId),
        getFocusSessions(userId),
        getRewardsSummary(userId),
      ]);

      const done = allTasks
        .filter((t) => t.status === "completed")
        .sort((a, b) => {
          const tA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const tB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return tB - tA;
        });

      const active = allTasks.filter(
        (t) => t.status !== "completed" && t.status !== "archived"
      ).length;

      setCompletedTasks(done);
      setActiveTasksCount(active);
      setFocusSessions(sessions);
      setRewards(rewardSummary);
    } catch (err) {
      console.warn("Failed loading progress", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Calculate today's completed tasks
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const completedToday = completedTasks.filter((t) => {
    if (!t.completedAt) return false;
    const date = new Date(t.completedAt);
    return !isNaN(date.getTime()) && date >= startOfToday;
  });

  // Calculate total focus minutes
  const totalFocusSeconds = focusSessions.reduce(
    (acc, s) => acc + (s.durationSeconds || 0),
    0
  );
  const totalFocusMinutes = Math.round(totalFocusSeconds / 60);

  // Consistency / Calm Streak visual (7-day dots) backed by streak data
  const past7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = toLocalDateString(d.toISOString());

    const hasCreditedFocus = Boolean(rewards?.historyByDay[dayStr]);
    const hasCompletedTask = completedTasks.some((t) => {
      if (!t.completedAt) return false;
      return toLocalDateString(t.completedAt) === dayStr;
    });

    const active = hasCreditedFocus || hasCompletedTask;
    const dayName = d.toLocaleDateString("en-US", { weekday: "narrow" });
    return { dayName, active, isToday: i === 6 };
  });

  const handleDisabledRedeem = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert(
      "Stride Rewards",
      "Point redemption for Stride Pro time is coming soon. Every 15+ minute focus session continues building your momentum!"
    );
  };

  return (
    <View className="flex-1">
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["#12162C", "#1B203E", "#27274E"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <StrideScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: 110,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadProgress}
            tintColor={colors.accent}
          />
        }
      >
        {/* Header */}
        <View className="mb-6">
          <Text
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: colors.muted }}
          >
            MOMENTUM
          </Text>
          <Text
            className="mt-1 text-2xl font-bold tracking-tight"
            style={{ color: colors.ink }}
          >
            Daily Progress
          </Text>
        </View>

        {/* Rewards & Streak Card */}
        <View className="mb-6">
          <LiquidGlass shape="card" tone="strong">
            <View className="p-5">
              <View className="flex-row items-center justify-between mb-4">
                {/* Streak Block */}
                <View className="flex-row items-center gap-2.5">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                    <Flame size={22} color="#F59E0B" fill="#F59E0B" />
                  </View>
                  <View>
                    <View className="flex-row items-baseline gap-1">
                      <Text className="text-2xl font-bold" style={{ color: colors.ink }}>
                        {rewards?.currentStreak ?? 0}
                      </Text>
                      <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
                        days
                      </Text>
                    </View>
                    <Text className="text-[11px]" style={{ color: colors.muted }}>
                      Focus Streak
                    </Text>
                  </View>
                </View>

                {/* Points Block */}
                <View className="items-end">
                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-2xl font-bold" style={{ color: colors.accent }}>
                      {rewards?.totalPoints ?? 0}
                    </Text>
                    <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
                      pts
                    </Text>
                  </View>
                  <Text className="text-[11px]" style={{ color: colors.muted }}>
                    Balance
                  </Text>
                </View>
              </View>

              {/* Daily Capped / Status Explainer */}
              {rewards?.todaySessionPointsCapped ? (
                <View className="rounded-xl bg-white/5 px-3.5 py-2.5 mb-4">
                  <Text className="text-xs font-medium" style={{ color: colors.ink }}>
                    Today&apos;s focus points are maxed (20/20) — still counts toward your streak!
                  </Text>
                </View>
              ) : (rewards?.todaySessionPointsEarned ?? 0) > 0 ? (
                <View className="rounded-xl bg-white/5 px-3.5 py-2.5 mb-4">
                  <Text className="text-xs" style={{ color: colors.muted }}>
                    +{rewards?.todaySessionPointsEarned} pts earned today (max 20 pts/day from sessions).
                  </Text>
                </View>
              ) : null}

              {/* Disabled Redeem Affordance per spec */}
              <View className="pt-3 border-t border-white/10 flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Award size={14} color={colors.muted} />
                  <Text className="text-xs font-medium" style={{ color: colors.muted }}>
                    Redeem for Pro
                  </Text>
                </View>

                <Pressable onPress={handleDisabledRedeem}>
                  <View className="flex-row items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
                    <Lock size={11} color={colors.muted} />
                    <Text className="text-[11px] font-semibold" style={{ color: colors.muted }}>
                      Coming Soon
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </LiquidGlass>
        </View>

        {/* Today's Tally */}
        <View className="mb-6 flex-row gap-3">
          <View className="flex-1">
            <LiquidGlass shape="card" tone="strong">
              <View className="p-4 items-center">
                <Text className="text-3xl font-bold" style={{ color: colors.ink }}>
                  {completedToday.length}
                </Text>
                <Text className="mt-1 text-xs font-medium" style={{ color: colors.muted }}>
                  Finished Today
                </Text>
              </View>
            </LiquidGlass>
          </View>

          <View className="flex-1">
            <LiquidGlass shape="card">
              <View className="p-4 items-center">
                <Text className="text-3xl font-bold" style={{ color: colors.accent }}>
                  {activeTasksCount}
                </Text>
                <Text className="mt-1 text-xs font-medium" style={{ color: colors.muted }}>
                  Remaining
                </Text>
              </View>
            </LiquidGlass>
          </View>

          <View className="flex-1">
            <LiquidGlass shape="card">
              <View className="p-4 items-center">
                <Text className="text-3xl font-bold" style={{ color: colors.ink }}>
                  {totalFocusMinutes}m
                </Text>
                <Text className="mt-1 text-xs font-medium" style={{ color: colors.muted }}>
                  Deep Focus
                </Text>
              </View>
            </LiquidGlass>
          </View>
        </View>

        {/* Calm Consistency Rhythm */}
        <View className="mb-6">
          <Text
            className="mb-2.5 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            7-DAY RHYTHM
          </Text>

          <LiquidGlass shape="card">
            <View className="p-5">
              <View className="flex-row items-center justify-between">
                {past7Days.map((d, index) => (
                  <View key={index} className="items-center gap-2">
                    <View
                      className="h-9 w-9 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: d.active
                          ? colors.accentSoft
                          : "rgba(255, 255, 255, 0.05)",
                        borderWidth: d.isToday ? 1 : 0,
                        borderColor: colors.accent,
                      }}
                    >
                      {d.active ? (
                        <CheckCircle2 size={16} color={colors.accent} />
                      ) : (
                        <View
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: d.isToday
                              ? colors.muted
                              : "rgba(255, 255, 255, 0.15)",
                          }}
                        />
                      )}
                    </View>
                    <Text
                      className="text-xs font-medium"
                      style={{ color: d.isToday ? colors.ink : colors.muted }}
                    >
                      {d.dayName}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </LiquidGlass>
        </View>

        {/* COMPLETED TASKS LIST */}
        <View>
          <Text
            className="mb-2.5 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            COMPLETED ({completedTasks.length})
          </Text>

          {completedTasks.length > 0 ? (
            <View className="gap-2.5">
              {completedTasks.map((task) => (
                <Pressable
                  key={task.id}
                  onPress={() => router.push(`/task/${task.id}`)}
                >
                  <LiquidGlass shape="card">
                    <View className="flex-row items-center justify-between p-3.5">
                      <View className="mr-3 flex-1">
                        <Text
                          className="text-sm font-medium line-through"
                          style={{ color: colors.muted }}
                          numberOfLines={1}
                        >
                          {task.title}
                        </Text>
                        {task.completedAt && (
                          <Text className="mt-0.5 text-xs" style={{ color: "rgba(245,246,255,0.4)" }}>
                            Completed {new Date(task.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        )}
                      </View>
                      <CheckCircle2 size={18} color={colors.accent} />
                    </View>
                  </LiquidGlass>
                </Pressable>
              ))}
            </View>
          ) : (
            <LiquidGlass shape="card">
              <View className="items-center justify-center p-8 text-center">
                <CalendarCheck size={32} color={colors.accent} />
                <Text
                  className="mt-3 text-sm font-semibold"
                  style={{ color: colors.ink }}
                >
                  Your first completed task will appear here.
                </Text>
                <Text
                  className="mt-1 text-xs text-center leading-5"
                  style={{ color: colors.muted }}
                >
                  Finish your next move or complete a focus block to build your momentum streak.
                </Text>
              </View>
            </LiquidGlass>
          )}
        </View>
      </StrideScrollView>
    </View>
  );
}
