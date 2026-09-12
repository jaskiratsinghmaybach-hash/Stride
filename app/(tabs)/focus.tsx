import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Play,
  Sparkles,
  Target,
  Zap,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import { createTask, getTask } from "@/services/tasks/taskClient";

const PRESET_DURATIONS = [25, 45, 90];

export default function FocusEntryScreen() {
  const params = useLocalSearchParams<{ taskId?: string }>();
  const { colors } = useStrideTheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = session?.user?.id;

  const [step, setStep] = useState<"hero" | "q1" | "q2">("hero");
  const [taskTitle, setTaskTitle] = useState("");
  const [existingTaskId, setExistingTaskId] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [customDuration, setCustomDuration] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (params.taskId && userId) {
      getTask(userId, params.taskId).then((t) => {
        if (t) {
          setExistingTaskId(t.id);
          setTaskTitle(t.title);
          setStep("q1");
        }
      });
    }
  }, [params.taskId, userId]);

  const handleNextFromQ1 = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStep("q2");
  };

  const handleLaunchSession = async () => {
    if (!userId || isSubmitting) return;

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      let finalTaskId = existingTaskId;

      if (!finalTaskId) {
        // Create ad-hoc task with source: 'focus_quick_start' per spec
        const title = taskTitle.trim() || "Deep Focus Block";
        const created = await createTask(userId, {
          title,
          source: "focus_quick_start",
          status: "inbox",
          priority: "normal",
        });
        finalTaskId = created.id;
      }

      const finalDuration = customDuration.trim()
        ? parseInt(customDuration.trim(), 10) || durationMinutes
        : durationMinutes;

      router.push({
        pathname: "/focus/session",
        params: {
          taskId: finalTaskId,
          targetDurationMinutes: finalDuration.toString(),
        },
      });
    } catch (err) {
      console.warn("Failed launching focus session", err);
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["#12162C", "#1D1A40", "#2C2554"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View
        className="flex-1 px-6 justify-between"
        style={{
          paddingTop: Math.max(insets.top, 16) + 16,
          paddingBottom: Math.max(insets.bottom, 16) + 30,
        }}
      >
        {/* Navigation & Header */}
        <View className="flex-row items-center justify-between">
          {step !== "hero" ? (
            <Pressable
              onPress={() => setStep(step === "q2" ? "q1" : "hero")}
              hitSlop={12}
            >
              <LiquidGlass shape="pill" intensity={24}>
                <View className="h-9 w-9 items-center justify-center">
                  <ArrowLeft size={16} color={colors.ink} />
                </View>
              </LiquidGlass>
            </Pressable>
          ) : (
            <View className="flex-row items-center gap-2">
              <Sparkles size={14} color={colors.accent} />
              <Text
                className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: colors.muted }}
              >
                DEEP WORK
              </Text>
            </View>
          )}

          {step !== "hero" && (
            <Text className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
              {step === "q1" ? "STEP 1 OF 2" : "STEP 2 OF 2"}
            </Text>
          )}
        </View>

        {/* Dynamic Step Content */}
        <View className="flex-1 justify-center py-6">
          {step === "hero" && (
            <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)}>
              <View className="items-center text-center mb-8">
                <View className="h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/15 mb-4">
                  <Target size={32} color={colors.accent} />
                </View>
                <Text
                  className="text-3xl font-bold tracking-tight text-center"
                  style={{ color: colors.ink }}
                >
                  Enter Deep Focus
                </Text>
                <Text
                  className="mt-2 text-sm text-center leading-6 max-w-xs"
                  style={{ color: colors.muted }}
                >
                  Strip away distractions, calibrate your rhythm, and protect your uninterrupted work block.
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setStep("q1");
                }}
              >
                <LiquidGlass shape="pill" tone="hero" style={{ width: "100%" }}>
                  <View className="flex-row items-center justify-center gap-2 py-4">
                    <Play size={16} color={colors.ink} fill={colors.ink} />
                    <Text className="text-base font-semibold" style={{ color: colors.ink }}>
                      Start Focus
                    </Text>
                  </View>
                </LiquidGlass>
              </Pressable>
            </Animated.View>
          )}

          {step === "q1" && (
            <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)}>
              <Text
                className="text-xs font-bold uppercase tracking-wider mb-1"
                style={{ color: colors.accent }}
              >
                QUESTION 1
              </Text>
              <Text
                className="text-2xl font-bold tracking-tight mb-6"
                style={{ color: colors.ink }}
              >
                What are you working on?
              </Text>

              <LiquidGlass shape="card" tone="strong">
                <View className="p-4">
                  <TextInput
                    value={taskTitle}
                    onChangeText={setTaskTitle}
                    placeholder="Focus objective (e.g. Finish quarterly presentation deck)"
                    placeholderTextColor="rgba(245, 246, 255, 0.4)"
                    autoFocus
                    multiline
                    style={{
                      color: colors.ink,
                      fontSize: 18,
                      lineHeight: 26,
                      minHeight: 100,
                      textAlignVertical: "top",
                    }}
                  />
                </View>
              </LiquidGlass>

              <Pressable onPress={handleNextFromQ1} className="mt-6">
                <LiquidGlass shape="pill" tone="hero">
                  <View className="flex-row items-center justify-center gap-2 py-3.5">
                    <Text className="text-sm font-semibold" style={{ color: colors.ink }}>
                      Continue
                    </Text>
                    <ArrowRight size={16} color={colors.ink} />
                  </View>
                </LiquidGlass>
              </Pressable>
            </Animated.View>
          )}

          {step === "q2" && (
            <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)}>
              <Text
                className="text-xs font-bold uppercase tracking-wider mb-1"
                style={{ color: colors.accent }}
              >
                QUESTION 2
              </Text>
              <Text
                className="text-2xl font-bold tracking-tight mb-6"
                style={{ color: colors.ink }}
              >
                How long do you need?
              </Text>

              {/* Preset Duration Pills */}
              <View className="flex-row gap-3 mb-4">
                {PRESET_DURATIONS.map((mins) => {
                  const isSelected = !customDuration && durationMinutes === mins;
                  return (
                    <Pressable
                      key={mins}
                      onPress={() => {
                        setCustomDuration("");
                        setDurationMinutes(mins);
                      }}
                      className="flex-1"
                    >
                      <LiquidGlass shape="pill" tone={isSelected ? "active" : "default"}>
                        <View className="items-center justify-center py-3.5">
                          <Text
                            className="text-sm font-semibold"
                            style={{ color: isSelected ? colors.ink : colors.muted }}
                          >
                            {mins} min
                          </Text>
                        </View>
                      </LiquidGlass>
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom Duration Input */}
              <LiquidGlass shape="card">
                <View className="p-3.5 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Clock size={16} color={colors.accent} />
                    <Text className="text-xs font-medium" style={{ color: colors.muted }}>
                      Custom Duration (minutes)
                    </Text>
                  </View>
                  <TextInput
                    value={customDuration}
                    onChangeText={setCustomDuration}
                    placeholder="e.g. 30"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    style={{
                      color: colors.ink,
                      fontSize: 14,
                      fontWeight: "600",
                      width: 70,
                      textAlign: "right",
                    }}
                  />
                </View>
              </LiquidGlass>

              <Pressable
                onPress={handleLaunchSession}
                disabled={isSubmitting}
                className="mt-6"
              >
                <LiquidGlass shape="pill" tone="hero">
                  <View className="flex-row items-center justify-center gap-2 py-4">
                    <Play size={16} color={colors.ink} fill={colors.ink} />
                    <Text className="text-base font-semibold" style={{ color: colors.ink }}>
                      Enter Focus ({customDuration ? `${customDuration} min` : `${durationMinutes} min`})
                    </Text>
                  </View>
                </LiquidGlass>
              </Pressable>
            </Animated.View>
          )}
        </View>

        {/* Bottom subtle brand quote / footnote */}
        <View className="items-center">
          <Text className="text-[11px]" style={{ color: "rgba(245, 246, 255, 0.3)" }}>
            STRIDE Focus Mode · Pure concentration
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
