import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useStrideTheme } from "@/theme/StrideThemeProvider";

const priorityItems = [
  { title: "Your highest-priority item", spark: true },
  { title: "Your next meaningful action", spark: false },
  { title: "One thing to finish", spark: false },
];

export default function TodayScreen() {
  const { colors } = useStrideTheme();
  const { profile, signOut } = useAuth();
  const router = useRouter();

  return (
    <View className="flex-1">
      <View style={StyleSheet.absoluteFill}>
        {/* Calm, static version of the onboarding gradient's resting state.
            No motion here on purpose — this screen is visited daily and
            shouldn't keep "performing" the way the first-run onboarding does. */}
        <LinearGradient
          colors={["#14172E", "#332C63", "#4C4292"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View className="flex-1 px-6 pt-16">
        <Stack.Screen options={{ title: "Today" }} />

        <View className="mb-8 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-sm font-medium tracking-widest" style={{ color: colors.muted }}>
              YOUR DAY
            </Text>
            <Text className="mt-2 text-4xl font-semibold" style={{ color: colors.ink }}>
              {profile?.name ? `Good morning, ${profile.name}.` : "What matters today?"}
            </Text>
          </View>
          <Pressable
            onPress={async () => {
              await signOut();
              router.replace("/onboarding");
            }}
            hitSlop={12}
          >
            <LiquidGlass shape="pill">
              <View className="px-4 py-2">
                <Text className="text-sm font-medium" style={{ color: colors.ink }}>
                  Sign out
                </Text>
              </View>
            </LiquidGlass>
          </Pressable>
        </View>

        <Text className="mb-5 text-base leading-6" style={{ color: colors.muted }}>
          STRIDE will turn the context you choose to connect into a focused plan.
        </Text>

        <View className="gap-4">
          {priorityItems.map((item, i) => (
            <LiquidGlass key={item.title} shape="card" tone={item.spark ? "active" : "default"}>
              <View className="flex-row items-start p-5">
                <View
                  className="mr-4 h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: item.spark ? colors.spark : colors.accentSoft }}
                >
                  <Text className="font-semibold" style={{ color: item.spark ? "#2A1710" : colors.accent }}>
                    {i + 1}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold" style={{ color: colors.ink }}>
                    {item.title}
                  </Text>
                  <Text className="mt-1 leading-5" style={{ color: colors.muted }}>
                    This will be generated from STRIDE&apos;s understood context.
                  </Text>
                </View>
              </View>
            </LiquidGlass>
          ))}
        </View>
      </View>
    </View>
  );
}