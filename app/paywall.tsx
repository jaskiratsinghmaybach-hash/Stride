import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Check,
  Crown,
  Lock,
  Sparkles,
  Zap,
} from "lucide-react-native";

import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { StrideScrollView } from "@/components/ui/StrideScrollView";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import type { StrideEntitlement } from "@/services/revenuecat/revenueCatClient";
import { getEntitlement } from "@/services/revenuecat/revenueCatClient";

export default function PaywallScreen() {
  const { colors } = useStrideTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [entitlement, setEntitlement] = useState<StrideEntitlement>("free");

  useEffect(() => {
    getEntitlement().then(setEntitlement);
  }, []);

  const handleUpgradePress = () => {
    Alert.alert(
      "Stride Pro",
      "RevenueCat SDK integration will activate in the next release. You are currently exploring the post-auth product preview.",
      [{ text: "Understood" }]
    );
  };

  const handleRestore = async () => {
    const current = await getEntitlement();
    Alert.alert(
      "Restore Purchases",
      `Current active entitlement tier: ${current.toUpperCase()}`,
      [{ text: "OK" }]
    );
  };

  return (
    <View className="flex-1">
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["#12162C", "#1D1C44", "#302256"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <StrideScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: 40,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation Header */}
        <View className="mb-6 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <LiquidGlass shape="pill" intensity={28}>
              <View className="h-10 w-10 items-center justify-center">
                <ArrowLeft size={18} color={colors.ink} />
              </View>
            </LiquidGlass>
          </Pressable>

          <Pressable onPress={handleRestore} hitSlop={12}>
            <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
              Restore
            </Text>
          </Pressable>
        </View>

        {/* Framing Headline */}
        <View className="items-center mb-8">
          <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20">
            <Crown size={26} color={colors.accent} />
          </View>
          <Text className="text-2xl font-bold text-center tracking-tight" style={{ color: colors.ink }}>
            Elevate Your Reasoning Depth
          </Text>
          <Text className="mt-2 text-xs text-center leading-5 max-w-[280px]" style={{ color: colors.muted }}>
            Stride Pro is not a cosmetic upgrade. It unlocks deep multi-document
            understanding and multi-step cognitive planning.
          </Text>
        </View>

        {/* Two-Tier Cards */}
        <View className="gap-5 mb-8">
          {/* FREE TIER */}
          <LiquidGlass shape="card">
            <View className="p-5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base font-bold" style={{ color: colors.ink }}>
                  Stride Free
                </Text>
                {entitlement === "free" && (
                  <View className="rounded-full bg-white/10 px-2.5 py-0.5">
                    <Text className="text-[10px] font-semibold uppercase" style={{ color: colors.accent }}>
                      Current Plan
                    </Text>
                  </View>
                )}
              </View>

              <Text className="text-xs mb-4" style={{ color: colors.muted }}>
                Essential local-first execution and daily focus rhythms.
              </Text>

              <View className="gap-2 border-t border-white/10 pt-3">
                <View className="flex-row items-center gap-2">
                  <Check size={14} color={colors.accent} />
                  <Text className="text-xs" style={{ color: colors.ink }}>
                    Deterministic Next Move calculation
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Check size={14} color={colors.accent} />
                  <Text className="text-xs" style={{ color: colors.ink }}>
                    Distraction-free focus timer & streak
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Check size={14} color={colors.accent} />
                  <Text className="text-xs" style={{ color: colors.ink }}>
                    Up to 10 context vault items
                  </Text>
                </View>
              </View>
            </View>
          </LiquidGlass>

          {/* PRO TIER */}
          <LiquidGlass shape="card" tone="active">
            <View className="p-5">
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center gap-2">
                  <Sparkles size={16} color={colors.accent} />
                  <Text className="text-lg font-bold" style={{ color: colors.ink }}>
                    Stride Pro
                  </Text>
                </View>
                <Text className="text-sm font-bold" style={{ color: colors.ink }}>
                  $9.99 / mo
                </Text>
              </View>

              <Text className="text-xs mb-4" style={{ color: colors.muted }}>
                Full cognitive synthesis across all your personal context.
              </Text>

              <View className="gap-2.5 border-t border-white/10 pt-3">
                <View className="flex-row items-start gap-2">
                  <Check size={14} color={colors.accent} className="mt-0.5" />
                  <Text className="text-xs flex-1" style={{ color: colors.ink }}>
                    Unlimited multimodal context vault (PDFs, notes, voice dumps)
                  </Text>
                </View>
                <View className="flex-row items-start gap-2">
                  <Check size={14} color={colors.accent} className="mt-0.5" />
                  <Text className="text-xs flex-1" style={{ color: colors.ink }}>
                    Gemini cognitive daily reasoning & automatic context connection
                  </Text>
                </View>
                <View className="flex-row items-start gap-2">
                  <Check size={14} color={colors.accent} className="mt-0.5" />
                  <Text className="text-xs flex-1" style={{ color: colors.ink }}>
                    Proactive morning briefings based on actual calendar commitments
                  </Text>
                </View>
                <View className="flex-row items-start gap-2">
                  <Check size={14} color={colors.accent} className="mt-0.5" />
                  <Text className="text-xs flex-1" style={{ color: colors.ink }}>
                    Encrypted cloud backup & cross-device sync
                  </Text>
                </View>
              </View>

              <Pressable onPress={handleUpgradePress} className="mt-5">
                <LiquidGlass shape="pill" tone="hero">
                  <View className="py-3 items-center justify-center">
                    <Text className="text-sm font-semibold" style={{ color: colors.ink }}>
                      Upgrade to Pro
                    </Text>
                  </View>
                </LiquidGlass>
              </Pressable>
            </View>
          </LiquidGlass>
        </View>
      </StrideScrollView>
    </View>
  );
}
