import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { useStrideTheme } from "@/theme/StrideThemeProvider";

const priorities = ["Work", "Study", "Health", "Personal", "Projects"];
const slides = [
  ["MEET STRIDE", "Understand your day.", "STRIDE quietly turns the context you choose to connect into something useful."],
  ["LESS ORGANIZING", "Focus on what matters.", "Instead of making another giant task list, STRIDE helps surface the few things worth your attention."],
  ["BUILT AROUND YOU", "Your day, your way.", "Start with a little context about you. STRIDE will use it to make the experience personal."],
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export default function OnboardingScreen() {
  const router = useRouter();
  const { signInWithGoogle, saveOnboarding } = useAuth();
  const { colors } = useStrideTheme();
  const [step, setStep] = useState(0);
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
    const value = `${String(pickerHour).padStart(2, "0")}:${String(pickerMinute).padStart(2, "0")}`;
    if (timePicker === "start") setDayStart(value);
    if (timePicker === "end") setDayEnd(value);
    setTimePicker(null);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      style={{ backgroundColor: colors.background }}
    >
      <View className="flex-1 px-6 pt-14" style={{ backgroundColor: colors.background }}>
        <View className="mb-5 flex-row items-center justify-between">
          <Pressable
            onPress={() => step > 0 && goToStep(step - 1)}
            disabled={step === 0 || busy}
            hitSlop={14}
            className="h-10 w-10 items-start justify-center"
          >
            <Text className="text-3xl" style={{ color: step === 0 ? colors.background : colors.ink }}>
              ‹
            </Text>
          </Pressable>

          <View className="flex-row items-center gap-2">
            {Array.from({ length: total }).map((_, i) => (
              <Animated.View
                key={i}
                className="h-1.5 rounded-full"
                entering={FadeIn.duration(140)}
                style={{
                  width: i === step ? 28 : 8,
                  backgroundColor: i <= step ? colors.accent : colors.shadowLight,
                }}
              />
            ))}
          </View>

          <Text className="w-10 text-right text-sm font-medium" style={{ color: colors.muted }}>
            {step + 1}/{total}
          </Text>
        </View>

        <ScrollView
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
          <Animated.View
            key={step}
            entering={FadeInDown.duration(190).easing(Easing.out(Easing.cubic))}
          >
            {step < 3 && (
              <View>
                <Text className="text-sm font-semibold tracking-widest" style={{ color: colors.accent }}>
                  {slides[step][0]}
                </Text>
                <Text className="mt-4 text-5xl font-semibold leading-[58px]" style={{ color: colors.ink }}>
                  {slides[step][1]}
                </Text>
                <Text className="mt-5 max-w-[560px] text-lg leading-7" style={{ color: colors.muted }}>
                  {slides[step][2]}
                </Text>
              </View>
            )}

            {step === 3 && (
              <View>
                <Text className="text-sm font-semibold tracking-widest" style={{ color: colors.accent }}>
                  LET&apos;S MAKE IT YOURS
                </Text>
                <Text className="mt-4 text-4xl font-semibold" style={{ color: colors.ink }}>
                  What should I call you?
                </Text>
                <View className="mt-8 rounded-[26px] px-5 py-4" style={cardStyle(colors)}>
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
                <Text className="mt-3 px-1 text-sm" style={{ color: colors.muted }}>
                  You can change this anytime.
                </Text>
              </View>
            )}

            {step === 4 && (
              <View>
                <Text className="text-sm font-semibold tracking-widest" style={{ color: colors.accent }}>
                  YOUR WORLD
                </Text>
                <Text className="mt-4 text-4xl font-semibold" style={{ color: colors.ink }}>
                  What matters to you?
                </Text>
                <Text className="mt-3 text-base leading-6" style={{ color: colors.muted }}>
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
                        <Pressable
                          onPress={() =>
                            setSelected((current) =>
                              active ? current.filter((v) => v !== item) : [...current, item],
                            )
                          }
                          className="rounded-[20px] px-5 py-4"
                          style={{
                            ...cardStyle(colors),
                            backgroundColor: active ? colors.accentSoft : colors.surface,
                            borderWidth: active ? 1 : 0,
                            borderColor: colors.accent,
                          }}
                        >
                          <Text className="font-semibold" style={{ color: active ? colors.accent : colors.ink }}>
                            {item}
                          </Text>
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                </View>
              </View>
            )}

            {step === 5 && (
              <View>
                <Text className="text-sm font-semibold tracking-widest" style={{ color: colors.accent }}>
                  YOUR RHYTHM
                </Text>
                <Text className="mt-4 text-4xl font-semibold" style={{ color: colors.ink }}>
                  When does your day run?
                </Text>
                <Text className="mt-3 text-base leading-6" style={{ color: colors.muted }}>
                  This helps STRIDE choose better moments for planning and reminders.
                </Text>

                <View className="mt-7 gap-3">
                  <TimeField label="Day starts" value={dayStart} onPress={() => openTimePicker("start")} />
                  <TimeField label="Wind down" value={dayEnd} onPress={() => openTimePicker("end")} />
                </View>

                <View className="mt-6 rounded-[22px] px-5 py-4" style={{ backgroundColor: colors.surface }}>
                  <Text className="text-sm leading-5" style={{ color: colors.muted }}>
                    Next, we&apos;ll save your STRIDE securely with Google. You can connect more of your device when you&apos;re ready.
                  </Text>
                </View>
              </View>
            )}

            {!!error && (
              <Text className="mt-5 text-center text-sm" style={{ color: "#B42318" }}>
                {error}
              </Text>
            )}

            <View className="mt-7 w-full items-end">
              <ActionButton
                label={step === total - 1 ? "Continue with Google" : "Continue"}
                disabled={!canContinue || busy}
                busy={busy}
                onPress={next}
                colors={colors}
              />
            </View>
          </Animated.View>
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

function cardStyle(colors: ReturnType<typeof useStrideTheme>["colors"]) {
  return {
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  };
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
  const { colors } = useStrideTheme();
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between rounded-[24px] px-5 py-4" style={cardStyle(colors)}>
      <Text className="font-medium" style={{ color: colors.ink }}>
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        <Text className="text-lg font-semibold" style={{ color: colors.accent }}>
          {value}
        </Text>
        <Text className="text-base" style={{ color: colors.muted }}>›</Text>
      </View>
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
  colors: ReturnType<typeof useStrideTheme>["colors"];
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 80 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 100 }); }}
        className="flex-row items-center rounded-[20px] px-5 py-3.5"
        style={{
          backgroundColor: disabled ? colors.disabled : colors.accent,
          shadowColor: colors.shadow,
          shadowOffset: { width: 4, height: 4 },
          shadowOpacity: disabled ? 0 : 0.14,
          shadowRadius: 8,
          elevation: disabled ? 0 : 4,
        }}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text className="text-base font-semibold text-white">{label}</Text>
            <Text className="ml-2 text-lg font-semibold text-white">→</Text>
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
  colors: ReturnType<typeof useStrideTheme>["colors"];
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(20, 28, 45, 0.28)" }}>
        <Animated.View
          entering={FadeInDown.duration(180).easing(Easing.out(Easing.cubic))}
          className="rounded-t-[30px] px-6 pb-8 pt-5"
          style={{ backgroundColor: colors.background }}
        >
          <View className="mb-5 flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-semibold tracking-widest" style={{ color: colors.accent }}>
                CHOOSE TIME
              </Text>
              <Text className="mt-1 text-3xl font-semibold" style={{ color: colors.ink }}>
                {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: colors.surface }}>
              <Text className="text-xl" style={{ color: colors.ink }}>×</Text>
            </Pressable>
          </View>

          <Text className="mb-2 text-xs font-semibold" style={{ color: colors.muted }}>HOUR</Text>
          <View className="flex-row flex-wrap gap-2">
            {HOURS.map((value) => {
              const active = value === hour;
              return (
                <Pressable
                  key={value}
                  onPress={() => onHourChange(value)}
                  className="h-10 w-[13%] items-center justify-center rounded-[12px]"
                  style={{ backgroundColor: active ? colors.accent : colors.surface }}
                >
                  <Text className="text-sm font-semibold" style={{ color: active ? "#FFFFFF" : colors.ink }}>
                    {String(value).padStart(2, "0")}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mb-2 mt-5 text-xs font-semibold" style={{ color: colors.muted }}>MINUTE</Text>
          <View className="flex-row flex-wrap gap-2">
            {MINUTES.map((value) => {
              const active = value === minute;
              return (
                <Pressable
                  key={value}
                  onPress={() => onMinuteChange(value)}
                  className="h-10 flex-1 items-center justify-center rounded-[12px]"
                  style={{ minWidth: "14%", backgroundColor: active ? colors.accent : colors.surface }}
                >
                  <Text className="text-sm font-semibold" style={{ color: active ? "#FFFFFF" : colors.ink }}>
                    {String(value).padStart(2, "0")}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={onConfirm} className="mt-6 items-center rounded-[18px] px-5 py-3.5" style={{ backgroundColor: colors.accent }}>
            <Text className="font-semibold text-white">Set {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}