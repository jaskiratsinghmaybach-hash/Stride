import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  CheckCircle2,
  FileText,
  Music,
  Pause,
  Play,
  VolumeX,
  X,
  Zap,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import type { Task } from "@/types/task";
import type { ContextItem } from "@/types/contextItem";
import type { FocusSession } from "@/types/focus";
import { getTask } from "@/services/tasks/taskClient";
import { getContextItemsByIds } from "@/services/vault/vaultClient";
import {
  abandonFocusSession,
  completeFocusSession,
  recordFocusProgress,
  startFocusSession,
} from "@/services/focus/focusClient";
import { musicClient } from "@/services/music/musicClient";

export default function FocusSessionScreen() {
  const { taskId, targetDurationMinutes } = useLocalSearchParams<{
    taskId: string;
    targetDurationMinutes?: string;
  }>();

  const { colors } = useStrideTheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = session?.user?.id;

  const targetSeconds = (parseInt(targetDurationMinutes || "25", 10) || 25) * 60;

  const [task, setTask] = useState<Task | null>(null);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [musicState, setMusicState] = useState("unavailable");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize session
  useEffect(() => {
    let mounted = true;
    async function init() {
      if (!userId || !taskId) return;
      try {
        const [taskData, mState] = await Promise.all([
          getTask(userId, taskId),
          musicClient.getState(),
        ]);
        if (!mounted) return;

        setTask(taskData);
        setMusicState(mState);

        if (taskData?.relatedContextIds?.length) {
          const items = await getContextItemsByIds(userId, taskData.relatedContextIds);
          if (mounted) setContextItems(items);
        }

        const newSession = await startFocusSession(userId, taskId);
        if (mounted) setFocusSession(newSession);
      } catch (err) {
        console.warn("Failed initializing focus session", err);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [userId, taskId]);

  // Timer interval
  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        // Sync progress every 30s
        if (next % 30 === 0 && userId && focusSession?.id) {
          recordFocusProgress(userId, focusSession.id, next).catch(() => {});
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, userId, focusSession?.id]);

  const togglePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsPaused((prev) => !prev);
  };

  const handleFinish = async () => {
    if (!userId || !focusSession?.id) {
      router.replace("/today");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await completeFocusSession(userId, focusSession.id, elapsedSeconds, true);
    router.replace("/(tabs)/progress");
  };

  const handleExit = () => {
    Alert.alert(
      "Leave Focus?",
      "Your session progress will be stopped. Are you sure?",
      [
        { text: "Keep Focusing", style: "cancel" },
        {
          text: "End Session",
          style: "destructive",
          onPress: async () => {
            if (userId && focusSession?.id) {
              await abandonFocusSession(userId, focusSession.id, elapsedSeconds);
            }
            router.back();
          },
        },
      ]
    );
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progressRatio = Math.min(1, elapsedSeconds / targetSeconds);

  return (
    <View className="flex-1 bg-[#0A0C18]">
      {/* Deep immersive dark background */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["#0C0E1E", "#15162D", "#1C1C3A"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View
        className="flex-1 px-6"
        style={{
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: Math.max(insets.bottom, 16) + 20,
        }}
      >
        {/* Minimal Header (Stripped chrome) */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <Text
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: colors.muted }}
            >
              FOCUS IN PROGRESS
            </Text>
          </View>

          <Pressable
            onPress={handleExit}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close session"
          >
            <LiquidGlass shape="pill" intensity={24}>
              <View className="h-9 w-9 items-center justify-center">
                <X size={16} color={colors.ink} />
              </View>
            </LiquidGlass>
          </Pressable>
        </View>

        {/* Center Timer Display */}
        <View className="flex-1 items-center justify-center">
          <View className="items-center mb-6">
            <Text
              className="text-6xl font-light tracking-tighter"
              style={{ color: colors.ink }}
            >
              {formatTime(elapsedSeconds)}
            </Text>
            <Text className="mt-2 text-xs font-medium" style={{ color: colors.muted }}>
              Target: {Math.floor(targetSeconds / 60)} min ({Math.round(progressRatio * 100)}%)
            </Text>
          </View>

          {/* Task Objective Card */}
          <LiquidGlass shape="card" tone="strong" style={{ width: "100%", maxWidth: 380 }}>
            <View className="p-5">
              <View className="flex-row items-center gap-2 mb-2">
                <Zap size={14} color={colors.accent} />
                <Text
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: colors.accent }}
                >
                  Current Priority
                </Text>
              </View>

              <Text
                className="text-lg font-semibold leading-6"
                style={{ color: colors.ink }}
              >
                {task?.title || "Focusing..."}
              </Text>

              {task?.description ? (
                <Text
                  className="mt-1 text-xs leading-4"
                  style={{ color: colors.muted }}
                  numberOfLines={2}
                >
                  {task.description}
                </Text>
              ) : null}

              {/* Connected Context */}
              {contextItems.length > 0 && (
                <View className="mt-3 pt-3 border-t border-white/10">
                  <Text className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: colors.muted }}>
                    Linked Context
                  </Text>
                  {contextItems.slice(0, 2).map((ci) => (
                    <View key={ci.id} className="flex-row items-center gap-1.5 py-0.5">
                      <FileText size={12} color={colors.accent} />
                      <Text className="text-xs" style={{ color: colors.ink }} numberOfLines={1}>
                        {ci.title}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </LiquidGlass>

          {/* Music State (Truthful display per spec) */}
          <View className="mt-6 flex-row items-center gap-2 rounded-full bg-white/5 px-4 py-2">
            <VolumeX size={14} color={colors.muted} />
            <Text className="text-xs" style={{ color: colors.muted }}>
              Soundscape: {musicState === "unavailable" ? "Unavailable (No provider)" : musicState}
            </Text>
          </View>
        </View>

        {/* Bottom Actions: Pause & Done */}
        <View className="flex-row items-center gap-3">
          <Pressable onPress={togglePause} className="flex-1">
            <LiquidGlass shape="pill">
              <View className="flex-row items-center justify-center gap-2 py-3.5">
                {isPaused ? (
                  <>
                    <Play size={16} color={colors.ink} fill={colors.ink} />
                    <Text className="text-sm font-semibold" style={{ color: colors.ink }}>
                      Resume
                    </Text>
                  </>
                ) : (
                  <>
                    <Pause size={16} color={colors.ink} />
                    <Text className="text-sm font-semibold" style={{ color: colors.ink }}>
                      Pause
                    </Text>
                  </>
                )}
              </View>
            </LiquidGlass>
          </Pressable>

          <Pressable onPress={handleFinish} className="flex-1">
            <LiquidGlass shape="pill" tone="hero">
              <View className="flex-row items-center justify-center gap-2 py-3.5">
                <CheckCircle2 size={16} color={colors.ink} />
                <Text className="text-sm font-semibold" style={{ color: colors.ink }}>
                  I&apos;m done
                </Text>
              </View>
            </LiquidGlass>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
