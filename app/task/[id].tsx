import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Play,
  RotateCcw,
  Timer,
  Trash2,
  Zap,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import type { Task, TaskPriority, TaskStatus } from "@/types/task";
import type { ContextItem } from "@/types/contextItem";
import type { FocusSession } from "@/types/focus";
import { deleteTask, getTask, updateTask } from "@/services/tasks/taskClient";
import { getContextItemsByIds } from "@/services/vault/vaultClient";
import { getFocusSessions } from "@/services/focus/focusClient";

const STATUS_FLOW: TaskStatus[] = ["inbox", "planned", "in_progress", "completed"];

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useStrideTheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = session?.user?.id;

  const [task, setTask] = useState<Task | null>(null);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!userId || !id) {
      setIsLoading(false);
      return;
    }
    try {
      const [t, allSessions] = await Promise.all([
        getTask(userId, id),
        getFocusSessions(userId),
      ]);
      setTask(t);

      if (t?.relatedContextIds?.length) {
        const items = await getContextItemsByIds(userId, t.relatedContextIds);
        setContextItems(items);
      }

      setFocusSessions(allSessions.filter((s) => s.taskId === id));
    } catch (err) {
      console.warn("Failed loading task details", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCycleStatus = async () => {
    if (!task || !userId) return;
    const currentIndex = STATUS_FLOW.indexOf(task.status);
    const nextStatus = STATUS_FLOW[(currentIndex + 1) % STATUS_FLOW.length];

    const updates: Partial<Task> = { status: nextStatus };
    if (nextStatus === "completed") {
      updates.completedAt = new Date().toISOString();
    }

    const updated = await updateTask(userId, task.id, updates);
    if (updated) setTask(updated);
  };

  const handleCyclePriority = async () => {
    if (!task || !userId) return;
    const priorities: TaskPriority[] = ["low", "normal", "high"];
    const currentIdx = priorities.indexOf(task.priority);
    const nextPriority = priorities[(currentIdx + 1) % priorities.length];

    const updated = await updateTask(userId, task.id, { priority: nextPriority });
    if (updated) setTask(updated);
  };

  const handleDelete = () => {
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!userId || !task) return;
          await deleteTask(userId, task.id);
          router.back();
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#12162C]">
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!task) {
    return (
      <View className="flex-1 items-center justify-center bg-[#12162C] px-6">
        <Text className="text-base font-semibold" style={{ color: colors.ink }}>
          Task not found.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-sm font-semibold" style={{ color: colors.accent }}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["#12162C", "#1E2042", "#2B2856"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView overScrollMode="always" className="flex-1"
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: 40,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation Bar */}
        <View className="mb-6 flex-row items-center justify-between">
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

          <Pressable
            onPress={handleDelete}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Delete task"
          >
            <LiquidGlass shape="pill" intensity={28}>
              <View className="h-10 w-10 items-center justify-center">
                <Trash2 size={18} color={colors.spark} />
              </View>
            </LiquidGlass>
          </Pressable>
        </View>

        {/* Status and Priority Pill Controls */}
        <View className="flex-row items-center gap-2 mb-4">
          <Pressable onPress={handleCycleStatus}>
            <LiquidGlass shape="pill" tone={task.status === "completed" ? "active" : "default"}>
              <View className="flex-row items-center gap-1.5 px-3.5 py-1.5">
                <CheckCircle2 size={13} color={task.status === "completed" ? colors.ink : colors.accent} />
                <Text
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: task.status === "completed" ? colors.ink : colors.accent }}
                >
                  {task.status.replace("_", " ")}
                </Text>
              </View>
            </LiquidGlass>
          </Pressable>

          <Pressable onPress={handleCyclePriority}>
            <LiquidGlass shape="pill">
              <View className="flex-row items-center gap-1.5 px-3 py-1.5">
                <Zap size={13} color={task.priority === "high" ? colors.accent : colors.muted} />
                <Text className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.ink }}>
                  {task.priority} Priority
                </Text>
              </View>
            </LiquidGlass>
          </Pressable>
        </View>

        {/* Title & Description */}
        <Text className="text-2xl font-bold leading-8" style={{ color: colors.ink }}>
          {task.title}
        </Text>

        {task.description ? (
          <Text className="mt-3 text-sm leading-6" style={{ color: colors.muted }}>
            {task.description}
          </Text>
        ) : null}

        {/* Metadata Details */}
        <View className="mt-6">
          <LiquidGlass shape="card">
            <View className="p-4 gap-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Calendar size={15} color={colors.accent} />
                  <Text className="text-xs font-medium" style={{ color: colors.muted }}>
                    Due Date
                  </Text>
                </View>
                <Text className="text-xs font-semibold" style={{ color: colors.ink }}>
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "None set"}
                </Text>
              </View>

              <View className="flex-row items-center justify-between border-t border-white/10 pt-2.5">
                <View className="flex-row items-center gap-2">
                  <Clock size={15} color={colors.accent} />
                  <Text className="text-xs font-medium" style={{ color: colors.muted }}>
                    Estimated Time
                  </Text>
                </View>
                <Text className="text-xs font-semibold" style={{ color: colors.ink }}>
                  {task.estimatedMinutes ? `${task.estimatedMinutes} minutes` : "Not specified"}
                </Text>
              </View>
            </View>
          </LiquidGlass>
        </View>

        {/* Start Focus Action */}
        <View className="mt-6">
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(tabs)/focus",
                params: { taskId: task.id },
              })
            }
          >
            <LiquidGlass shape="pill" tone="hero">
              <View className="flex-row items-center justify-center gap-2 py-3.5">
                <Play size={16} color={colors.ink} fill={colors.ink} />
                <Text className="text-sm font-semibold" style={{ color: colors.ink }}>
                  Focus on this
                </Text>
              </View>
            </LiquidGlass>
          </Pressable>
        </View>

        {/* Connected Context */}
        <View className="mt-6">
          <Text
            className="mb-2.5 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            LINKED VAULT CONTEXT
          </Text>

          {contextItems.length > 0 ? (
            <View className="gap-2">
              {contextItems.map((ci) => (
                <Pressable
                  key={ci.id}
                  onPress={() => router.push(`/vault/${ci.id}`)}
                >
                  <LiquidGlass shape="card">
                    <View className="flex-row items-center justify-between p-3.5">
                      <View className="flex-row items-center gap-2.5">
                        <FileText size={16} color={colors.accent} />
                        <Text className="text-sm font-medium" style={{ color: colors.ink }}>
                          {ci.title}
                        </Text>
                      </View>
                      <Text className="text-xs uppercase font-semibold" style={{ color: colors.muted }}>
                        {ci.type}
                      </Text>
                    </View>
                  </LiquidGlass>
                </Pressable>
              ))}
            </View>
          ) : (
            <LiquidGlass shape="card">
              <View className="p-4 items-center justify-center">
                <Text className="text-xs" style={{ color: colors.muted }}>
                  No vault context linked to this task.
                </Text>
              </View>
            </LiquidGlass>
          )}
        </View>

        {/* Focus Session History */}
        <View className="mt-6">
          <Text
            className="mb-2.5 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            FOCUS HISTORY
          </Text>

          {focusSessions.length > 0 ? (
            <View className="gap-2">
              {focusSessions.map((s) => (
                <LiquidGlass key={s.id} shape="card">
                  <View className="flex-row items-center justify-between p-3.5">
                    <View className="flex-row items-center gap-2">
                      <Timer size={15} color={colors.accent} />
                      <Text className="text-xs font-medium" style={{ color: colors.ink }}>
                        {new Date(s.startedAt).toLocaleDateString()} · {Math.round(s.durationSeconds / 60)} min
                      </Text>
                    </View>
                    <Text className="text-[10px] font-semibold uppercase" style={{ color: colors.muted }}>
                      {s.status}
                    </Text>
                  </View>
                </LiquidGlass>
              ))}
            </View>
          ) : (
            <LiquidGlass shape="card">
              <View className="p-4 items-center justify-center">
                <Text className="text-xs" style={{ color: colors.muted }}>
                  No focus sessions recorded yet for this task.
                </Text>
              </View>
            </LiquidGlass>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
