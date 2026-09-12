import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Calendar, Layers, Timer, TrendingUp } from "lucide-react-native";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useStrideTheme } from "@/theme/StrideThemeProvider";

const TAB_CONFIG: Record<
  string,
  { label: string; icon: (props: { color: string; size: number }) => React.ReactNode }
> = {
  today: {
    label: "Today",
    icon: ({ color, size }) => <Calendar size={size} color={color} strokeWidth={2} />,
  },
  vault: {
    label: "Vault",
    icon: ({ color, size }) => <Layers size={size} color={color} strokeWidth={2} />,
  },
  focus: {
    label: "Focus",
    icon: ({ color, size }) => <Timer size={size} color={color} strokeWidth={2} />,
  },
  progress: {
    label: "Progress",
    icon: ({ color, size }) => <TrendingUp size={size} color={color} strokeWidth={2} />,
  },
};

export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useStrideTheme();
  const insets = useSafeAreaInsets();

  const bottomOffset = Math.max(16, insets.bottom + 6);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          bottom: bottomOffset,
        },
      ]}
    >
      <LiquidGlass shape="pill" tone="strong" intensity={42} style={styles.pillGlass}>
        <View style={styles.tabRow}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const config = TAB_CONFIG[route.name] ?? {
              label: route.name,
              icon: ({ color, size }: { color: string; size: number }) => (
                <Calendar size={size} color={color} />
              ),
            };

            const onPress = () => {
              Haptics.selectionAsync().catch(() => {});
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const iconColor = isFocused ? colors.ink : colors.muted;

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={[
                  styles.tabButton,
                  isFocused && { backgroundColor: colors.accentSoft },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={config.label}
              >
                {config.icon({ color: iconColor, size: 18 })}
                {isFocused && (
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: colors.ink },
                    ]}
                    numberOfLines={1}
                  >
                    {config.label}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </LiquidGlass>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pillGlass: {
    maxWidth: 380,
    shadowColor: "#05061A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    gap: 6,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
