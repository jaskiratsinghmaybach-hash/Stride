import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useStrideTheme } from "@/theme/StrideThemeProvider";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export function AnimatedGradientBackground({ step }: { step: number }) {
  const { gradientSteps } = useStrideTheme();
  const stepProgress = useSharedValue(step);
  const drift = useSharedValue(0);

  useEffect(() => {
    stepProgress.value = withTiming(step, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [step, stepProgress]);

  useEffect(() => {
    // Slow perpetual breathing motion so the gradient never feels static,
    // independent of step changes.
    drift.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [drift]);

  const animatedProps = useAnimatedProps(() => {
    const clampedIndex = Math.min(gradientSteps.length - 1, Math.max(0, Math.round(stepProgress.value)));
    const prevIndex = Math.max(0, clampedIndex - 1);
    const from = gradientSteps[prevIndex];
    const to = gradientSteps[clampedIndex];
    const t = Math.min(1, Math.abs(stepProgress.value - prevIndex));

    const c0 = interpolateColor(t, [0, 1], [from[0], to[0]]);
    const c1 = interpolateColor(t, [0, 1], [from[1], to[1]]);
    const c2 = interpolateColor(t, [0, 1], [from[2], to[2]]);

    return {
      colors: [c0, c1, c2],
      start: { x: 0.1 + drift.value * 0.08, y: 0.05 },
      end: { x: 0.85 - drift.value * 0.08, y: 0.95 },
    };
  });

  return (
    <AnimatedLinearGradient
      // @ts-expect-error -- animatedProps drives colors/start/end each frame
      animatedProps={animatedProps}
      style={StyleSheet.absoluteFill}
    />
  );
}