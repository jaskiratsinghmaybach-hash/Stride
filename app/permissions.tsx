import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Bell,
  Calendar,
  Camera,
  CheckCircle2,
  FileText,
  Mic,
  Shield,
  XCircle,
} from "lucide-react-native";

import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
} from "@/services/notifications/notificationClient";

type PermissionItem = {
  id: string;
  name: string;
  icon: (color: string) => React.ReactNode;
  why: string;
  granted: boolean;
  canRequest: boolean;
  onRequest: () => Promise<void>;
};

export default function PermissionsScreen() {
  const { colors } = useStrideTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [notificationGranted, setNotificationGranted] = useState(false);

  useEffect(() => {
    getNotificationPermissionStatus().then((status) => {
      setNotificationGranted(status === "granted");
    });
  }, []);

  const handleRequestNotification = async () => {
    const granted = await requestNotificationPermission();
    setNotificationGranted(granted);
    if (!granted && Platform.OS !== "web") {
      Alert.alert(
        "Permission Required",
        "Enable notifications in device settings to receive morning rhythm briefings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleGenericPermission = (name: string, why: string) => {
    Alert.alert(
      `${name} Permission`,
      `${why}\n\nSTRIDE never accesses device resources without an explicit action initiated by you.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Device Settings", onPress: () => Linking.openSettings() },
      ]
    );
  };

  const items: PermissionItem[] = [
    {
      id: "notifications",
      name: "Notifications",
      icon: (c) => <Bell size={18} color={c} />,
      why: "Sends morning briefing summaries and focus timer completion cues.",
      granted: notificationGranted,
      canRequest: true,
      onRequest: handleRequestNotification,
    },
    {
      id: "files",
      name: "Files & Documents",
      icon: (c) => <FileText size={18} color={c} />,
      why: "Allows indexing documents you explicitly import into the Vault.",
      granted: false,
      canRequest: true,
      onRequest: async () =>
        handleGenericPermission(
          "Files & Documents",
          "Used only when selecting files to add to your Knowledge Vault."
        ),
    },
    {
      id: "calendar",
      name: "Calendar",
      icon: (c) => <Calendar size={18} color={c} />,
      why: "Correlates upcoming commitments against your available focus blocks.",
      granted: false,
      canRequest: true,
      onRequest: async () =>
        handleGenericPermission(
          "Calendar",
          "STRIDE reads scheduled event windows locally to calculate focus availability."
        ),
    },
    {
      id: "photos",
      name: "Photos & Media",
      icon: (c) => <Camera size={18} color={c} />,
      why: "Enables extracting action items from whiteboards or document photos.",
      granted: false,
      canRequest: true,
      onRequest: async () =>
        handleGenericPermission(
          "Photos",
          "Used strictly on demand when capturing photo notes."
        ),
    },
    {
      id: "microphone",
      name: "Microphone",
      icon: (c) => <Mic size={18} color={c} />,
      why: "Powers quick voice capture of thought streams and task dumps.",
      granted: false,
      canRequest: true,
      onRequest: async () =>
        handleGenericPermission(
          "Microphone",
          "Audio is processed only during active recording and never recorded continuously."
        ),
    },
  ];

  return (
    <View className="flex-1">
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["#12162C", "#1E2248", "#2E2A60"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: 40,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation Bar */}
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <LiquidGlass shape="pill" intensity={28}>
              <View className="h-10 w-10 items-center justify-center">
                <ArrowLeft size={18} color={colors.ink} />
              </View>
            </LiquidGlass>
          </Pressable>

          <Text className="text-xl font-bold" style={{ color: colors.ink }}>
            Permission Center
          </Text>
        </View>

        {/* Philosophy Callout */}
        <View className="mb-6">
          <LiquidGlass shape="card" tone="strong">
            <View className="p-4 flex-row items-start gap-3">
              <Shield size={20} color={colors.accent} className="mt-0.5" />
              <View className="flex-1">
                <Text className="text-sm font-semibold" style={{ color: colors.ink }}>
                  Explicit Access Only
                </Text>
                <Text className="mt-1 text-xs leading-5" style={{ color: colors.muted }}>
                  STRIDE never runs silent background collectors. Every permission below
                  is requested on-demand when you trigger an action.
                </Text>
              </View>
            </View>
          </LiquidGlass>
        </View>

        {/* Permissions List */}
        <View className="gap-3">
          {items.map((item) => (
            <LiquidGlass key={item.id} shape="card">
              <View className="p-4">
                <View className="flex-row items-center justify-between mb-1.5">
                  <View className="flex-row items-center gap-2.5">
                    <View className="h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                      {item.icon(colors.accent)}
                    </View>
                    <Text className="text-sm font-semibold" style={{ color: colors.ink }}>
                      {item.name}
                    </Text>
                  </View>

                  <View
                    className="flex-row items-center gap-1 rounded-full px-2.5 py-0.5"
                    style={{
                      backgroundColor: item.granted
                        ? "rgba(52, 211, 153, 0.16)"
                        : "rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    {item.granted ? (
                      <>
                        <CheckCircle2 size={11} color="#34D399" />
                        <Text className="text-[10px] font-semibold text-emerald-400">
                          Granted
                        </Text>
                      </>
                    ) : (
                      <>
                        <XCircle size={11} color={colors.muted} />
                        <Text className="text-[10px] font-semibold" style={{ color: colors.muted }}>
                          Not Granted
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                <Text className="text-xs leading-5" style={{ color: colors.muted }}>
                  {item.why}
                </Text>

                <View className="mt-3 flex-row justify-end">
                  <Pressable onPress={item.onRequest}>
                    <LiquidGlass shape="pill">
                      <View className="px-3 py-1.5">
                        <Text className="text-xs font-medium" style={{ color: colors.ink }}>
                          {item.granted ? "Manage" : "Request Access"}
                        </Text>
                      </View>
                    </LiquidGlass>
                  </Pressable>
                </View>
              </View>
            </LiquidGlass>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
