import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/auth/AuthProvider";
import { StrideThemeProvider, useStrideTheme } from "@/theme/StrideThemeProvider";

function RootContent() {
  const { colors } = useStrideTheme();
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <StrideThemeProvider>
      <AuthProvider>
        <RootContent />
      </AuthProvider>
    </StrideThemeProvider>
  );
}
