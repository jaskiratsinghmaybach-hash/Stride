import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/auth/AuthProvider";
import { StrideThemeProvider } from "@/theme/StrideThemeProvider";

export default function RootLayout() {
  return (
    <StrideThemeProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: "#E8ECF4" }
        }} />
      </AuthProvider>
    </StrideThemeProvider>
  );
}
