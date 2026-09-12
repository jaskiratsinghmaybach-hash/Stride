import { useCallback } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { StrideScrollView } from "@/components/ui/StrideScrollView";
import { useToday } from "@/hooks/useToday";
import { useStrideTheme } from "@/theme/StrideThemeProvider";

export default function TodayScreen() {
  const { colors } = useStrideTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    nextMove,
    upNext,
    relatedContext,
    resume,
    isLoading,
    refresh,
    completeTask,
  } = useToday();

  const getGreeting = () => {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    return profile?.name ? `Good ${timeOfDay}, ${profile.name}.` : "What matters today?";
  };

  return (
    <View className="flex-1">
      {/* Calm, static background gradient */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["#14172E", "#332C63", "#4C4292"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <StrideScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: 110, // space for floating tab bar and capture button
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Header with Greeting and Actions */}
        <View className="mb-6 flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: colors.muted }}
            >
              YOUR DAY
            </Text>
            <Text
              className="mt-1 text-2xl font-bold tracking-tight"
              style={{ color: colors.ink }}
            >
              {getGreeting()}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push("/search")}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <LiquidGlass shape="pill" intensity={28}>
                <View className="h-10 w-10 items-center justify-center">
                  <Search size={18} color={colors.ink} />
                </View>
              </LiquidGlass>
            </Pressable>

            <Pressable
              onPress={() => router.push("/settings")}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <LiquidGlass shape="pill" intensity={28}>
                <View className="h-10 w-10 items-center justify-center">
                  <Settings size={18} color={colors.ink} />
                </View>
              </LiquidGlass>
            </Pressable>
          </View>
        </View>

        {/* RESUME SECTION (rendered strictly if real prior in-progress activity exists) */}
        {resume && (
          <View className="mb-6">
            <Text
              className="mb-2 text-xs font-semibold tracking-wider uppercase"
              style={{ color: colors.muted }}
            >
              RESUME ACTIVE WORK
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/focus/session",
                  params: { taskId: resume.id },
                })
              }
            >
              <LiquidGlass shape="card" tone="strong">
                <View className="flex-row items-center justify-between p-4">
                  <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20">
                    <RotateCcw size={18} color={colors.accent} />
                  </View>
                  <View className="flex-1 pr-2">
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.ink }}
                      numberOfLines={1}
                    >
                      {resume.title}
                    </Text>
                    <Text className="mt-0.5 text-xs" style={{ color: colors.muted }}>
                      In progress · Continue focus block
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1 rounded-full bg-white/10 px-3 py-1.5">
                    <Play size={12} color={colors.ink} fill={colors.ink} />
                    <Text className="text-xs font-medium" style={{ color: colors.ink }}>
                      Resume
                    </Text>
                  </View>
                </View>
              </LiquidGlass>
            </Pressable>
          </View>
        )}

        {/* YOUR NEXT MOVE (The single place where coral is allowed) */}
        <View className="mb-6">
          <View className="mb-2.5 flex-row items-center justify-between">
            <Text
              className="text-xs font-semibold tracking-wider uppercase"
              style={{ color: colors.muted }}
            >
              YOUR NEXT MOVE
            </Text>
            {nextMove && (
              <View className="flex-row items-center gap-1">
                <Sparkles size={12} color={colors.accent} />
                <Text className="text-xs font-medium" style={{ color: colors.accent }}>
                  {Math.round(nextMove.confidence * 100)}% match
                </Text>
              </View>
            )}
          </View>

          {nextMove ? (
            <LiquidGlass shape="card" tone="active">
              <View className="p-5">
                {/* Coral spark badge - the single intentional coral accent */}
                <View className="mb-3 flex-row items-center justify-between">
                  <View
                    className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
                    style={{ backgroundColor: "rgba(255, 139, 107, 0.16)" }}
                  >
                    <View
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: colors.spark }}
                    />
                    <Text
                      className="text-xs font-bold tracking-wider"
                      style={{ color: colors.spark }}
                    >
                      HIGHEST LEVERAGE
                    </Text>
                  </View>

                  {nextMove.task.estimatedMinutes && (
                    <View className="flex-row items-center gap-1">
                      <Clock size={13} color={colors.muted} />
                      <Text className="text-xs" style={{ color: colors.muted }}>
                        {nextMove.task.estimatedMinutes}m
                      </Text>
                    </View>
                  )}
                </View>

                <Pressable
                  onPress={() => router.push(`/task/${nextMove.task.id}`)}
                  hitSlop={6}
                >
                  <Text
                    className="text-xl font-bold leading-6"
                    style={{ color: colors.ink }}
                  >
                    {nextMove.task.title}
                  </Text>
                  {nextMove.task.description ? (
                    <Text
                      className="mt-1.5 text-sm leading-5"
                      style={{ color: colors.muted }}
                      numberOfLines={2}
                    >
                      {nextMove.task.description}
                    </Text>
                  ) : null}
                </Pressable>

                <View className="mt-3 flex-row items-center gap-2">
                  <Compass size={14} color={colors.accent} />
                  <Text
                    className="flex-1 text-xs italic"
                    style={{ color: colors.muted }}
                    numberOfLines={1}
                  >
                    {nextMove.reason}
                  </Text>
                </View>

                {/* CTAs */}
                <View className="mt-4 flex-row items-center gap-3 pt-2">
                  <Pressable
                    className="flex-1"
                    onPress={() =>
                      router.push({
                        pathname: "/focus/session",
                        params: { taskId: nextMove.task.id },
                      })
                    }
                  >
                    <LiquidGlass shape="pill" tone="hero">
                      <View className="flex-row items-center justify-center gap-2 py-3">
                        <Play size={15} color={colors.ink} fill={colors.ink} />
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: colors.ink }}
                        >
                          Start Focus
                        </Text>
                      </View>
                    </LiquidGlass>
                  </Pressable>

                  <Pressable
                    onPress={() => completeTask(nextMove.task.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Mark done"
                  >
                    <LiquidGlass shape="pill">
                      <View className="h-11 w-11 items-center justify-center">
                        <CheckCircle2 size={20} color={colors.accent} />
                      </View>
                    </LiquidGlass>
                  </Pressable>
                </View>
              </View>
            </LiquidGlass>
          ) : (
            <LiquidGlass shape="card">
              <View className="items-center justify-center p-6 text-center">
                <Compass size={28} color={colors.accent} />
                <Text
                  className="mt-3 text-sm font-medium"
                  style={{ color: colors.ink }}
                >
                  We&apos;re getting to know your day.
                </Text>
                <Text
                  className="mt-1 text-xs text-center leading-4"
                  style={{ color: colors.muted }}
                >
                  Capture what&apos;s on your mind or create a task to calculate your next move.
                </Text>
              </View>
            </LiquidGlass>
          )}
        </View>

        {/* UP NEXT SECTION (max 3 compact rows) */}
        <View className="mb-6">
          <Text
            className="mb-2 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            UP NEXT
          </Text>

          {upNext.length > 0 ? (
            <View className="gap-2.5">
              {upNext.map((task) => (
                <Pressable
                  key={task.id}
                  onPress={() => router.push(`/task/${task.id}`)}
                >
                  <LiquidGlass shape="card">
                    <View className="flex-row items-center justify-between p-3.5">
                      <View className="mr-3 flex-1">
                        <View className="flex-row items-center gap-2">
                          <View
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                task.priority === "high"
                                  ? colors.accent
                                  : "rgba(255,255,255,0.4)",
                            }}
                          />
                          <Text
                            className="flex-1 text-sm font-medium"
                            style={{ color: colors.ink }}
                            numberOfLines={1}
                          >
                            {task.title}
                          </Text>
                        </View>
                        {task.estimatedMinutes ? (
                          <Text
                            className="mt-1 pl-4 text-xs"
                            style={{ color: colors.muted }}
                          >
                            ~{task.estimatedMinutes} mins
                          </Text>
                        ) : null}
                      </View>

                      <Pressable
                        onPress={() => completeTask(task.id)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Complete task"
                      >
                        <CheckCircle2 size={18} color={colors.muted} />
                      </Pressable>
                    </View>
                  </LiquidGlass>
                </Pressable>
              ))}
            </View>
          ) : (
            <LiquidGlass shape="card">
              <View className="p-4 items-center justify-center">
                <Text className="text-xs" style={{ color: colors.muted }}>
                  No additional tasks planned yet.
                </Text>
              </View>
            </LiquidGlass>
          )}
        </View>

        {/* CONTEXT SECTION (explaining why each is relevant) */}
        <View className="mb-6">
          <Text
            className="mb-2 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            RELEVANT CONTEXT
          </Text>

          {relatedContext.length > 0 ? (
            <View className="gap-2">
              {relatedContext.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/vault/${item.id}`)}
                >
                  <LiquidGlass shape="card">
                    <View className="flex-row items-center justify-between p-3">
                      <View className="mr-3 h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                        <FileText size={16} color={colors.accent} />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: colors.ink }}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text
                          className="mt-0.5 text-xs"
                          style={{ color: colors.muted }}
                          numberOfLines={1}
                        >
                          {item.aiSummary
                            ? item.aiSummary
                            : `Connected to your ${nextMove?.task.title ?? "day"}`}
                        </Text>
                      </View>
                      <ArrowRight size={14} color={colors.muted} />
                    </View>
                  </LiquidGlass>
                </Pressable>
              ))}
            </View>
          ) : (
            <LiquidGlass shape="card">
              <View className="p-4 items-center justify-center">
                <Text className="text-xs" style={{ color: colors.muted }}>
                  Connect documents or notes in the Vault to link context here.
                </Text>
              </View>
            </LiquidGlass>
          )}
        </View>

        {/* FOCUS ENTRY SECTION */}
        <View className="mb-4">
          <Text
            className="mb-2 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            FOCUS BLOCK
          </Text>

          <Pressable onPress={() => router.push("/focus")}>
            <LiquidGlass shape="card">
              <View className="flex-row items-center justify-between p-4">
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20">
                  <Zap size={20} color={colors.accent} />
                </View>
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-semibold" style={{ color: colors.ink }}>
                    Deep Focus Mode
                  </Text>
                  <Text className="mt-0.5 text-xs" style={{ color: colors.muted }}>
                    Timer, distraction-free atmosphere, rhythm tracking
                  </Text>
                </View>
                <ArrowRight size={16} color={colors.ink} />
              </View>
            </LiquidGlass>
          </Pressable>
        </View>
      </StrideScrollView>

      {/* FLOATING QUICK CAPTURE AFFORDANCE */}
      <View
        pointerEvents="box-none"
        style={[
          styles.captureContainer,
          {
            bottom: Math.max(16, insets.bottom + 74),
          },
        ]}
      >
        <Pressable
          onPress={() => router.push("/capture")}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Quick capture"
        >
          <LiquidGlass shape="pill" tone="hero" intensity={40} style={styles.captureButton}>
            <View className="flex-row items-center gap-2 px-4 py-3">
              <Plus size={18} color={colors.ink} strokeWidth={2.5} />
              <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.ink }}>
                Capture
              </Text>
            </View>
          </LiquidGlass>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  captureContainer: {
    position: "absolute",
    right: 20,
  },
  captureButton: {
    shadowColor: "#05061A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
