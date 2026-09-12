import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import { AnimatedGradientBackground } from "@/components/ui/AnimatedGradientBackground";
import { LiquidGlass } from "@/components/ui/LiquidGlass";

type ThemeColors = ReturnType<typeof useStrideTheme>["colors"];

const priorities = ["Work", "Study", "Health", "Personal", "Projects"];
const slides: [string, string, string][] = [
  [
    "MEET STRIDE",
    "Understand your day.",
    "STRIDE quietly turns the context you choose to connect into something useful.",
  ],
  [
    "LESS ORGANIZING",
    "Focus on what matters.",
    "Instead of making another giant task list, STRIDE helps surface the few things worth your attention.",
  ],
  [
    "BUILT AROUND YOU",
    "Your day, your way.",
    "Start with a little context about you. STRIDE will use it to make the experience personal.",
  ],
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export default function OnboardingScreen() {
  const router = useRouter();
  const { signInWithGoogle, saveOnboarding } = useAuth();
  const { colors } = useStrideTheme();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [dayStart, setDayStart] = useState("08:00");
  const [dayEnd, setDayEnd] = useState("22:00");
  const [timePicker, setTimePicker] = useState<"start" | "end" | null>(null);
  const [pickerHour, setPickerHour] = useState(8);
  const [pickerMinute, setPickerMinute] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const total = 6;

  const canContinue = useMemo(() => {
    if (step <= 2) return true;
    if (step === 3) return name.trim().length >= 2;
    if (step === 4) return selected.length > 0;
    return true;
  }, [name, selected, step]);

  function goToStep(nextStep: number) {
    Keyboard.dismiss();
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  async function next() {
    if (!canContinue || busy) return;

    if (step < total - 1) {
      goToStep(step + 1);
      return;
    }

    setBusy(true);
    setError("");

    const result = await signInWithGoogle();

    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }

    if (result.cancelled) {
      setBusy(false);
      return;
    }

    await saveOnboarding({
      name: name.trim(),
      priorities: selected,
      dayStart,
      dayEnd,
    });

    router.replace("/today");
    setBusy(false);
  }

  function openTimePicker(which: "start" | "end") {
    const value = which === "start" ? dayStart : dayEnd;
    const [hour, minute] = value.split(":").map(Number);

    setPickerHour(Number.isFinite(hour) ? hour : 8);
    setPickerMinute(Number.isFinite(minute) ? minute : 0);
    setTimePicker(which);
  }

  function confirmTime() {
    const value = `${String(pickerHour).padStart(2, "0")}:${String(
      pickerMinute
    ).padStart(2, "0")}`;

    if (timePicker === "start") setDayStart(value);
    if (timePicker === "end") setDayEnd(value);

    setTimePicker(null);
  }

  function togglePriority(item: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelected((current) =>
      current.includes(item)
        ? current.filter((v) => v !== item)
        : [...current, item]
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <View style={StyleSheet.absoluteFill}>
        <AnimatedGradientBackground step={step} />
      </View>

      <View className="flex-1 px-6 pt-14">
        <View className="mb-5 flex-row items-center justify-between">
          <Pressable
            onPress={() => step > 0 && goToStep(step - 1)}
            disabled={step === 0 || busy}
            hitSlop={14}
            className="h-10 w-10 items-start justify-center"
          >
            <Text
              className="text-3xl"
              style={{
                color: step === 0 ? "transparent" : colors.ink,
              }}
            >
              ‹
            </Text>
          </Pressable>

          <View className="flex-row items-center gap-2">
            {Array.from({ length: total }).map((_, i) => (
              <ProgressDot
                key={i}
                active={i <= step}
                current={i === step}
              />
            ))}
          </View>

          <Text
            className="w-10 text-right text-sm font-medium"
            style={{ color: colors.muted }}
          >
            {step + 1}/{total}
          </Text>
        </View>

        <ScrollView overScrollMode="always"
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: step === 3 ? "flex-start" : "center",
            paddingTop: step === 3 ? 24 : 8,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <StepTransition trigger={step} direction={direction}>
            {step < 3 && (
              <View>
                <Text
                  className="text-sm font-semibold tracking-widest"
                  style={{ color: colors.accent }}
                >
                  {slides[step][0]}
                </Text>

                <Text
                  className="mt-4 text-5xl font-semibold leading-[58px]"
                  style={{ color: colors.ink }}
                >
                  {slides[step][1]}
                </Text>

                <Text
                  className="mt-5 max-w-[560px] text-lg leading-7"
                  style={{ color: colors.muted }}
                >
                  {slides[step][2]}
                </Text>
              </View>
            )}

            {step === 3 && (
              <View>
                <Text
                  className="text-sm font-semibold tracking-widest"
                  style={{ color: colors.accent }}
                >
                  LET&apos;S MAKE IT YOURS
                </Text>

                <Text
                  className="mt-4 text-4xl font-semibold"
                  style={{ color: colors.ink }}
                >
                  What should I call you?
                </Text>

                <LiquidGlass shape="card" style={{ marginTop: 32 }}>
                  <View className="px-5 py-4">
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Your name"
                      placeholderTextColor={colors.muted}
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                      className="text-xl"
                      style={{ color: colors.ink }}
                      autoFocus
                    />
                  </View>
                </LiquidGlass>

                <Text
                  className="mt-3 px-1 text-sm"
                  style={{ color: colors.muted }}
                >
                  You can change this anytime.
                </Text>
              </View>
            )}

            {step === 4 && (
              <View>
                <Text
                  className="text-sm font-semibold tracking-widest"
                  style={{ color: colors.accent }}
                >
                  YOUR WORLD
                </Text>

                <Text
                  className="mt-4 text-4xl font-semibold"
                  style={{ color: colors.ink }}
                >
                  What matters to you?
                </Text>

                <Text
                  className="mt-3 text-base leading-6"
                  style={{ color: colors.muted }}
                >
                  Pick the areas STRIDE should understand first.
                </Text>

                <View className="mt-7 flex-row flex-wrap gap-3">
                  {priorities.map((item, index) => {
                    const active = selected.includes(item);

                    return (
                      <Animated.View
                        key={item}
                        entering={FadeIn.duration(150).delay(index * 35)}
                      >
                        <PriorityPill
                          label={item}
                          active={active}
                          onPress={() => togglePriority(item)}
                        />
                      </Animated.View>
                    );
                  })}
                </View>
              </View>
            )}

            {step === 5 && (
              <View>
                <Text
                  className="text-sm font-semibold tracking-widest"
                  style={{ color: colors.accent }}
                >
                  YOUR RHYTHM
                </Text>

                <Text
                  className="mt-4 text-4xl font-semibold"
                  style={{ color: colors.ink }}
                >
                  When does your day run?
                </Text>

                <Text
                  className="mt-3 text-base leading-6"
                  style={{ color: colors.muted }}
                >
                  This helps STRIDE choose better moments for planning and
                  reminders.
                </Text>

                <View className="mt-7 gap-3">
                  <TimeField
                    label="Day starts"
                    value={dayStart}
                    onPress={() => openTimePicker("start")}
                  />

                  <TimeField
                    label="Wind down"
                    value={dayEnd}
                    onPress={() => openTimePicker("end")}
                  />
                </View>

                <LiquidGlass shape="card" style={{ marginTop: 24 }}>
                  <View className="px-5 py-4">
                    <Text
                      className="text-sm leading-5"
                      style={{ color: colors.muted }}
                    >
                      Next, we&apos;ll save your STRIDE securely with Google.
                      You can connect more of your device when you&apos;re ready.
                    </Text>
                  </View>
                </LiquidGlass>
              </View>
            )}

            {!!error && (
              <Text
                className="mt-5 text-center text-sm"
                style={{ color: "#FFB4A8" }}
              >
                {error}
              </Text>
            )}

            <View className="mt-7 w-full items-end">
              <ActionButton
                label={
                  step === total - 1
                    ? "Continue with Google"
                    : "Continue"
                }
                disabled={!canContinue || busy}
                busy={busy}
                onPress={next}
                colors={colors}
              />
            </View>
          </StepTransition>
        </ScrollView>
      </View>

      <TimePickerModal
        visible={timePicker !== null}
        hour={pickerHour}
        minute={pickerMinute}
        onHourChange={setPickerHour}
        onMinuteChange={setPickerMinute}
        onClose={() => setTimePicker(null)}
        onConfirm={confirmTime}
        colors={colors}
      />
    </KeyboardAvoidingView>
  );
}

/** Directional slide+fade wrapper: moves forward steps in from the right, back steps from the left. */
function StepTransition({
  trigger,
  direction,
  children,
}: {
  trigger: number;
  direction: 1 | -1;
  children: ReactNode;
}) {
  return (
    <Animated.View
      key={trigger}
      entering={FadeIn.duration(220)
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({
          opacity: 0,
          transform: [
            { translateX: direction * 24 },
            { scale: 0.985 },
          ],
        } as any)}
    >
      {children}
    </Animated.View>
  );
}

function ProgressDot({
  active,
  current,
}: {
  active: boolean;
  current: boolean;
}) {
  const width = useSharedValue(current ? 28 : 8);

  useEffect(() => {
    width.value = withTiming(current ? 28 : 8, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [current, width]);

  const style = useAnimatedStyle(() => ({
    width: width.value,
  }));

  return (
    <Animated.View
      className="h-1.5 rounded-full"
      style={[
        style,
        {
          backgroundColor: active
            ? "#FFFFFF"
            : "rgba(255,255,255,0.28)",
        },
      ]}
    />
  );
}

function PriorityPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.95, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 120 });
        }}
      >
        <LiquidGlass
          shape="pill"
          tone={active ? "active" : "default"}
        >
          <View className="px-5 py-3.5">
            <Text
              className="font-semibold"
              style={{
                color: active
                  ? "#FFFFFF"
                  : "rgba(255,255,255,0.9)",
              }}
            >
              {label}
            </Text>
          </View>
        </LiquidGlass>
      </Pressable>
    </Animated.View>
  );
}

function TimeField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <LiquidGlass shape="card">
        <View className="flex-row items-center justify-between px-5 py-4">
          <Text
            className="font-medium"
            style={{ color: "#FFFFFF" }}
          >
            {label}
          </Text>

          <View className="flex-row items-center gap-2">
            <Text
              className="text-lg font-semibold"
              style={{ color: "#FFFFFF" }}
            >
              {value}
            </Text>

            <Text
              className="text-base"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              ›
            </Text>
          </View>
        </View>
      </LiquidGlass>
    </Pressable>
  );
}

function ActionButton({
  label,
  disabled,
  busy,
  onPress,
  colors,
}: {
  label: string;
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        disabled={disabled}
        onPress={() => {
          Haptics.impactAsync(
            Haptics.ImpactFeedbackStyle.Medium
          );
          onPress();
        }}
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 100 });
        }}
        className="flex-row items-center rounded-[20px] px-5 py-3.5"
        style={{
          backgroundColor: disabled
            ? colors.disabled
            : "#FFFFFF",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: disabled ? 0 : 0.22,
          shadowRadius: 14,
          elevation: disabled ? 0 : 5,
        }}
      >
        {busy ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <Text
              className="text-base font-semibold"
              style={{
                color: disabled ? colors.muted : "#22204A",
              }}
            >
              {label}
            </Text>

            <Text
              className="ml-2 text-lg font-semibold"
              style={{
                color: disabled ? colors.muted : "#22204A",
              }}
            >
              →
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

function TimePickerModal({
  visible,
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  onClose,
  onConfirm,
  colors,
}: {
  visible: boolean;
  hour: number;
  minute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  onClose: () => void;
  onConfirm: () => void;
  colors: ThemeColors;
}) {
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
      className="justify-end"
    >
      {/* Full-screen backdrop blur & dark overlay */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView
          intensity={Platform.OS === "ios" ? 40 : 60}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(5, 7, 18, 0.68)" },
          ]}
        />
      </Pressable>

      {/* Bottom Sheet Card */}
      <Animated.View
        entering={SlideInDown.duration(240).easing(Easing.out(Easing.cubic))}
        exiting={SlideOutDown.duration(180)}
        className="overflow-hidden rounded-t-[32px]"
        style={{
          backgroundColor: "#101426",
          borderTopWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.14)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.5,
          shadowRadius: 18,
          elevation: 24,
        }}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0)"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.7, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
          pointerEvents="none"
        />

        <View className="px-6 pb-9 pt-6">
          <View className="mb-5 flex-row items-center justify-between">
            <View>
              <Text
                className="text-xs font-semibold tracking-widest"
                style={{ color: colors.accent }}
              >
                CHOOSE TIME
              </Text>

              <Text
                className="mt-1 text-3xl font-semibold"
                style={{ color: colors.ink }}
              >
                {String(hour).padStart(2, "0")}:
                {String(minute).padStart(2, "0")}
              </Text>
            </View>

            <Pressable onPress={onClose} hitSlop={12}>
              <LiquidGlass shape="pill">
                <View className="h-10 w-10 items-center justify-center">
                  <Text
                    className="text-xl"
                    style={{ color: colors.ink }}
                  >
                    ×
                  </Text>
                </View>
              </LiquidGlass>
            </Pressable>
          </View>

          <Text
            className="mb-2 text-xs font-semibold"
            style={{ color: colors.muted }}
          >
            HOUR
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {HOURS.map((value) => (
              <TimeCell
                key={value}
                value={value}
                active={value === hour}
                onPress={() => {
                  Haptics.selectionAsync();
                  onHourChange(value);
                }}
                colors={colors}
              />
            ))}
          </View>

          <Text
            className="mb-2 mt-5 text-xs font-semibold"
            style={{ color: colors.muted }}
          >
            MINUTE
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {MINUTES.map((value) => (
              <TimeCell
                key={value}
                value={value}
                active={value === minute}
                onPress={() => {
                  Haptics.selectionAsync();
                  onMinuteChange(value);
                }}
                colors={colors}
                wide
              />
            ))}
          </View>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onConfirm();
            }}
            className="mt-6 items-center rounded-[18px] px-5 py-3.5"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            <Text
              className="font-semibold text-base"
              style={{ color: "#181A32" }}
            >
              Set {String(hour).padStart(2, "0")}:
              {String(minute).padStart(2, "0")}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function TimeCell({
  value,
  active,
  onPress,
  colors,
  wide = false,
}: {
  value: number;
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
  wide?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={wide ? "flex-1" : ""}
      style={
        wide
          ? { minWidth: "14%" }
          : { width: "13%" }
      }
    >
      <LiquidGlass
        shape="pill"
        tone={active ? "active" : "default"}
      >
        <View className="h-10 items-center justify-center">
          <Text
            className="text-sm font-semibold"
            style={{
              color: active ? "#FFFFFF" : colors.ink,
            }}
          >
            {String(value).padStart(2, "0")}
          </Text>
        </View>
      </LiquidGlass>
    </Pressable>
  );
}