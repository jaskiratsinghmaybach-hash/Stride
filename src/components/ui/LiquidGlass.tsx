import type { PropsWithChildren } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useStrideTheme } from "@/theme/StrideThemeProvider";

type Props = PropsWithChildren<{
  /** "pill" = fully rounded chip/button shape. "card" = soft rounded rect. */
  shape?: "pill" | "card";
  /** Visual weight of the glass. "active" is used for selected states. "hero" for prominent hero cards. */
  tone?: "default" | "active" | "strong" | "hero";
  style?: ViewStyle;
  innerStyle?: ViewStyle;
  intensity?: number;
}>;

/**
 * A hand-built "liquid glass" surface: BlurView for the frosted backdrop,
 * a soft diagonal specular highlight across the top, and a bright inner
 * border to sell the sense of a curved glass edge catching light — the
 * combination that reads as "liquid glass" rather than a flat blur.
 */
export function LiquidGlass({
  children,
  shape = "card",
  tone = "default",
  style,
  innerStyle,
  intensity = 34,
}: Props) {
  const { colors } = useStrideTheme();
  const radius = shape === "pill" ? 999 : 22;
  const backgroundTint =
    tone === "active"
      ? colors.accentSoft
      : tone === "hero"
      ? "rgba(139, 158, 255, 0.16)"
      : tone === "strong"
      ? colors.surfaceStrong
      : colors.surface;

  const borderColor =
    tone === "active" || tone === "hero" ? colors.accent : colors.glassBorder;

  const specularOpacity = tone === "hero" ? 0.24 : 0.16;

  return (
    <View style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
      <BlurView
        intensity={Platform.OS === "android" ? Math.min(intensity, 18) : intensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[colors.glassHighlight, "rgba(255,255,255,0)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.7, y: 0.6 }}
        style={[StyleSheet.absoluteFill, { opacity: specularOpacity }]}
      />
      <View
        style={[
          {
            borderRadius: radius,
            borderWidth: 1,
            borderColor,
            backgroundColor: backgroundTint,
          },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}