import { Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { NeumorphicCard } from "@/components/ui/NeumorphicCard";
import { useStrideTheme } from "@/theme/StrideThemeProvider";

export default function TodayScreen() {
  const { colors } = useStrideTheme();
  const { profile, signOut } = useAuth();
  const router = useRouter();
  return <View className="flex-1 px-6 pt-16" style={{ backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: "Today" }} />
    <View className="mb-8 flex-row items-start justify-between">
      <View className="flex-1">
        <Text className="text-sm font-medium" style={{ color: colors.muted }}>YOUR DAY</Text>
        <Text className="mt-2 text-4xl font-semibold" style={{ color: colors.ink }}>
          {profile?.name ? `Good morning, ${profile.name}.` : "What matters today?"}
        </Text>
      </View>
      <Pressable onPress={async () => { await signOut(); router.replace("/onboarding"); }} hitSlop={12}>
        <Text className="text-sm font-medium" style={{ color: colors.muted }}>Sign out</Text>
      </Pressable>
    </View>
    <Text className="mb-5 text-base" style={{ color: colors.muted }}>
      STRIDE will turn the context you choose to connect into a focused plan.
    </Text>
    <View className="gap-4">
      {["Your highest-priority item", "Your next meaningful action", "One thing to finish"].map((title, i) =>
        <NeumorphicCard key={title}><View className="flex-row items-start">
          <View className="mr-4 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: colors.accentSoft }}>
            <Text className="font-semibold" style={{ color: colors.accent }}>{i + 1}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold" style={{ color: colors.ink }}>{title}</Text>
            <Text className="mt-1 leading-5" style={{ color: colors.muted }}>This will be generated from STRIDE&apos;s understood context.</Text>
          </View>
        </View></NeumorphicCard>
      )}
    </View>
  </View>;
}
