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
  CheckCircle2,
  Clock,
  Flame,
  Play,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import type { Task } from "@/types/task";
import { getTasks } from "@/services/tasks/taskClient";
import { deterministicPrioritizer } from "@/services/prioritization/nextMove";

const FOCUS_DURATIONS = [15, 25, 45, 60];

export default function FocusEntryScreen() {
  const { colors } = useStrideTheme();
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = session?.user?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(25);

  const loadTasks = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    try {
      const all = await getTasks(userId);
      const active = all.filter((t) => t.status !== "completed" && t.status !== "archived");
      setTasks(active);

      if (active.length > 0) {
        // Auto-select next move or first active
        const nextMove = deterministicPrioritizer.getNextMove(active, new Date(), {
          dayStart: profile?.dayStart,
          dayEnd: profile?.dayEnd,
        });
        setSelectedTaskId(nextMove?.task?.id ?? active[0].id);
      }
    } catch (err) {
      console.warn("Failed loading tasks for focus", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, profile?.dayStart, profile?.dayEnd]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleStartSession = () => {
    if (!selectedTaskId) return;
    router.push({
      pathname: "/focus/session",
      params: {
        taskId: selectedTaskId,
        targetDurationMinutes: selectedDuration.toString(),
      },
    });
  };

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  return (
    <View className="flex-1">
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["#12162C", "#1D1A40", "#2C2554"]}
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
            onRefresh={loadTasks}
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
            DEEP WORK
          </Text>
          <Text
            className="mt-1 text-2xl font-bold tracking-tight"
            style={{ color: colors.ink }}
          >
            Focus Session
          </Text>
        </View>

        {/* Selected Task Highlight */}
        {selectedTask ? (
          <View className="mb-6">
            <Text
              className="mb-2.5 text-xs font-semibold tracking-wider uppercase"
              style={{ color: colors.muted }}
            >
              CHOSEN OBJECTIVE
            </Text>
            <LiquidGlass shape="card" tone="active">
              <View className="p-5">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5">
                    <Zap size={12} color={colors.accent} />
                    <Text className="text-xs font-semibold uppercase" style={{ color: colors.accent }}>
                      {selectedTask.priority} Priority
                    </Text>
                  </View>

                  {selectedTask.estimatedMinutes && (
                    <Text className="text-xs" style={{ color: colors.muted }}>
                      ~{selectedTask.estimatedMinutes}m est.
                    </Text>
                  )}
                </View>

                <Text className="text-lg font-bold" style={{ color: colors.ink }}>
                  {selectedTask.title}
                </Text>

                {selectedTask.description ? (
                  <Text className="mt-1.5 text-xs leading-5" style={{ color: colors.muted }}>
                    {selectedTask.description}
                  </Text>
                ) : null}

                {/* Duration Picker */}
                <View className="mt-4 pt-4 border-t border-white/10">
                  <Text className="text-xs font-medium mb-3" style={{ color: colors.muted }}>
                    Session Length
                  </Text>
                  <View className="flex-row gap-2">
                    {FOCUS_DURATIONS.map((mins) => {
                      const isSelected = selectedDuration === mins;
                      return (
                        <Pressable
                          key={mins}
                          onPress={() => setSelectedDuration(mins)}
                          className="flex-1"
                        >
                          <LiquidGlass
                            shape="pill"
                            tone={isSelected ? "active" : "default"}
                          >
                            <View className="items-center justify-center py-2">
                              <Text
                                className="text-xs font-semibold"
                                style={{
                                  color: isSelected ? colors.ink : colors.muted,
                                }}
                              >
                                {mins}m
                              </Text>
                            </View>
                          </LiquidGlass>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Launch Button */}
                <Pressable onPress={handleStartSession} className="mt-5">
                  <LiquidGlass shape="pill" tone="hero">
                    <View className="flex-row items-center justify-center gap-2 py-3.5">
                      <Play size={16} color={colors.ink} fill={colors.ink} />
                      <Text className="text-sm font-semibold tracking-wide" style={{ color: colors.ink }}>
                        Enter Focus ({selectedDuration} min)
                      </Text>
                    </View>
                  </LiquidGlass>
                </Pressable>
              </View>
            </LiquidGlass>
          </View>
        ) : (
          <LiquidGlass shape="card">
            <View className="items-center justify-center p-8 text-center">
              <Timer size={32} color={colors.accent} />
              <Text
                className="mt-3 text-sm font-semibold"
                style={{ color: colors.ink }}
              >
                Choose something worth your attention.
              </Text>
              <Text
                className="mt-1 text-xs text-center leading-5"
                style={{ color: colors.muted }}
              >
                Add or plan a task first. Focus mode strips distractions and protects
                your concentration block.
              </Text>
            </View>
          </LiquidGlass>
        )}

        {/* Task Selection List */}
        {tasks.length > 1 && (
          <View className="mt-6">
            <Text
              className="mb-2.5 text-xs font-semibold tracking-wider uppercase"
              style={{ color: colors.muted }}
            >
              SWITCH TARGET
            </Text>

            <View className="gap-2">
              {tasks.map((task) => {
                const isChosen = task.id === selectedTaskId;
                return (
                  <Pressable
                    key={task.id}
                    onPress={() => setSelectedTaskId(task.id)}
                  >
                    <LiquidGlass shape="card" tone={isChosen ? "active" : "default"}>
                      <View className="flex-row items-center justify-between p-3.5">
                        <Text
                          className="text-sm font-medium flex-1 pr-2"
                          style={{ color: colors.ink }}
                          numberOfLines={1}
                        >
                          {task.title}
                        </Text>
                        {isChosen ? (
                          <CheckCircle2 size={16} color={colors.accent} />
                        ) : (
                          <Text className="text-xs" style={{ color: colors.muted }}>
                            Select
                          </Text>
                        )}
                      </View>
                    </LiquidGlass>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
