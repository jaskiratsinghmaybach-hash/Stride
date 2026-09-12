import { Tabs } from "expo-router";
import { GlassTabBar } from "@/components/navigation/GlassTabBar";
import { useStrideTheme } from "@/theme/StrideThemeProvider";

export default function TabLayout() {
  const { colors } = useStrideTheme();

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="vault" options={{ title: "Vault" }} />
      <Tabs.Screen name="focus" options={{ title: "Focus" }} />
      <Tabs.Screen name="progress" options={{ title: "Progress" }} />
    </Tabs>
  );
}
