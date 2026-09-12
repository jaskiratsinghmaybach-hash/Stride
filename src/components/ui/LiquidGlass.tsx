import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useStrideTheme } from "@/theme/StrideThemeProvider";

type Props = PropsWithChildren<{
  /** "pill" = fully rounded chip/button shape. "card" = soft rounded rect. */
  shape?: "pill" | "card";
  /** Visual weight of the glass. "active" is used for selected states. */
  tone?: "default" | "active" | "strong";
  style?: ViewStyle;
  intensity?: number;
}>;

/**
 * A hand-built "liquid glass" surface: BlurView for the frosted backdrop,
 * a soft diagonal specular highlight across the top, and a bright inner
 * border to sell the sense of a curved glass edge catching light — the
 * combination that reads as "liquid glass" rather than a flat blur.
 */
export function LiquidGlass({ children, shape = "card", tone = "default", style, intensity = 34 }: Props) {
  const { colors } = useStrideTheme();
  const radius = shape === "pill" ? 999 : 22;
  const backgroundTint =
    tone === "active" ? colors.accentSoft : tone === "strong" ? colors.surfaceStrong : colors.surface;
  const borderColor = tone === "active" ? colors.accent : colors.glassBorder;

  return (
    <View style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[colors.glassHighlight, "rgba(255,255,255,0)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.7, y: 0.6 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.16 }]}
      />
      <View
        style={{
          borderRadius: radius,
          borderWidth: 1,
          borderColor,
          backgroundColor: backgroundTint,
        }}
      >
        {children}
      </View>
    </View>
  );
}