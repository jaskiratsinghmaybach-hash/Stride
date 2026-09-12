import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Flame,
  Sparkles,
  TrendingUp,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import type { Task } from "@/types/task";
import type { FocusSession } from "@/types/focus";
import { getTasks } from "@/services/tasks/taskClient";
import { getFocusSessions } from "@/services/focus/focusClient";

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

  const loadProgress = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    try {
      const [allTasks, sessions] = await Promise.all([
        getTasks(userId),
        getFocusSessions(userId),
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

  // Consistency / Calm Streak visual (7-day dots)
  const past7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    const hasCompletion = completedTasks.some((t) => {
      if (!t.completedAt) return false;
      const comp = new Date(t.completedAt);
      return comp >= dayStart && comp <= dayEnd;
    });

    const dayName = d.toLocaleDateString("en-US", { weekday: "narrow" });
    return { dayName, active: hasCompletion, isToday: i === 6 };
  });

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

      <ScrollView
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

        {/* Calm Consistency Rhythm (no loud analytics) */}
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

        {/* FUTURE EXTENSION POINT SEAM (per spec: clearly marked seam, no fake insights) */}
        <View className="mb-6">
          <LiquidGlass shape="card">
            <View className="p-4">
              <View className="flex-row items-center gap-2">
                <Sparkles size={14} color={colors.accent} />
                <Text
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: colors.accent }}
                >
                  Rhythm Intelligence (Future Pipeline)
                </Text>
              </View>
              <Text className="mt-1.5 text-xs leading-5" style={{ color: colors.muted }}>
                As STRIDE learns your completion patterns and energy curve, contextual
                timing suggestions will connect here.
              </Text>
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
      </ScrollView>
    </View>
  );
}
