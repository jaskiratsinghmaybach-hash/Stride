import { createContext, useContext, type PropsWithChildren } from "react";

// Core palette: deep indigo -> violet -> periwinkle, with a warm coral spark
// reserved for the final "activation" moment (last onboarding step / CTA accents).
const colors = {
  background: "#12162C",
  surface: "rgba(255,255,255,0.10)",
  surfaceStrong: "rgba(255,255,255,0.16)",
  ink: "#F5F6FF",
  muted: "rgba(245,246,255,0.68)",
  accent: "#8B9EFF",
  accentSoft: "rgba(139,158,255,0.22)",
  spark: "#FF8B6B",
  shadow: "#05061A",
  shadowLight: "rgba(255,255,255,0.24)",
  disabled: "rgba(255,255,255,0.14)",
  glassBorder: "rgba(255,255,255,0.22)",
  glassHighlight: "rgba(255,255,255,0.35)",
  glassTint: "rgba(255,255,255,0.08)",
};

// One gradient stop-set per onboarding step (0-indexed). Colors drift from
// cool/deep (intro) toward warmer periwinkle+coral as the user approaches
// the Google sign-in / activation moment. Consumed by AnimatedGradientBackground.
const gradientSteps: [string, string, string][] = [
  ["#12162C", "#2E2A6B", "#5C4FA8"],
  ["#181A38", "#3A3480", "#6E5FC4"],
  ["#1B1B42", "#463A9C", "#8072E0"],
  ["#20204C", "#4C3F91", "#8B9EFF"],
  ["#241F52", "#5A4AA8", "#9E8CFF"],
  ["#2B2258", "#6B4FA8", "#C98CFF"],
];

const Context = createContext({ colors, gradientSteps });

export function StrideThemeProvider({ children }: PropsWithChildren) {
  return <Context.Provider value={{ colors, gradientSteps }}>{children}</Context.Provider>;
}

export function useStrideTheme() {
  return useContext(Context);
}