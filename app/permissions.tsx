import { useCallback, useEffect, useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import * as Calendar from "expo-calendar";
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import { PermissionStatus } from "expo";
import * as DocumentPicker from "expo-document-picker";
import {
  ArrowLeft,
  Bell,
  Calendar as CalendarIcon,
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
  status: "granted" | "denied" | "undetermined";
  onRequest: () => Promise<void>;
};

export default function PermissionsScreen() {
  const { colors } = useStrideTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [notificationStatus, setNotificationStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [photoStatus, setPhotoStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [calendarStatus, setCalendarStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [micStatus, setMicStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [filesStatus, setFilesStatus] = useState<"granted" | "denied" | "undetermined">("granted");

  const checkAllStatuses = useCallback(async () => {
    try {
      // 1. Notifications
      const notif = await getNotificationPermissionStatus();
      setNotificationStatus(notif === "granted" ? "granted" : notif === "denied" ? "denied" : "undetermined");

      // 2. Photos
      const photoPerm = await ImagePicker.getMediaLibraryPermissionsAsync();
      setPhotoStatus(
        photoPerm.granted
          ? "granted"
          : photoPerm.status === ImagePicker.PermissionStatus.DENIED
          ? "denied"
          : "undetermined"
      );

      // 3. Calendar
      const calPerm = await Calendar.getCalendarPermissionsAsync();
      setCalendarStatus(
        calPerm.granted
          ? "granted"
          : calPerm.status === "denied"
          ? "denied"
          : "undetermined"
      );

      // 4. Microphone
      const micPerm = await getRecordingPermissionsAsync();
      setMicStatus(
        micPerm.granted
          ? "granted"
          : micPerm.status === PermissionStatus.DENIED
          ? "denied"
          : "undetermined"
      );

      // 5. Files: Scoped SAF / UIDocumentPicker is inherently granted on modern mobile OS
      setFilesStatus("granted");
    } catch (err) {
      console.warn("Failed checking permissions", err);
    }
  }, []);

  useEffect(() => {
    checkAllStatuses();
  }, [checkAllStatuses]);

  const handleRequestFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: "*/*",
      });
      if (!res.canceled) {
        Alert.alert("File Access Verified", `Successfully accessed: ${res.assets[0]?.name}`);
      }
      setFilesStatus("granted");
    } catch {
      setFilesStatus("granted");
    }
  };

  const handleRequestPhotos = async () => {
    try {
      const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const granted = res.granted;
      setPhotoStatus(granted ? "granted" : "denied");
      if (!granted && Platform.OS !== "web") {
        Alert.alert(
          "Photos Permission",
          "Enable photo library access in device settings to allow importing images into the Vault.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Device Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (err) {
      console.warn("Error requesting photos permission", err);
    }
  };

  const handleRequestCalendar = async () => {
    try {
      const res = await Calendar.requestCalendarPermissionsAsync();
      const granted = res.granted;
      setCalendarStatus(granted ? "granted" : "denied");
      if (!granted && Platform.OS !== "web") {
        Alert.alert(
          "Calendar Permission",
          "Enable read-only calendar access in device settings to allow Stride to calibrate your focus window around scheduled commitments.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Device Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (err) {
      console.warn("Error requesting calendar permission", err);
    }
  };

  const handleRequestNotifications = async () => {
    try {
      const granted = await requestNotificationPermission();
      setNotificationStatus(granted ? "granted" : "denied");
      if (!granted && Platform.OS !== "web") {
        Alert.alert(
          "Notification Permission",
          "Enable notifications in device settings to receive morning rhythm briefings and focus timer completions.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Device Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (err) {
      console.warn("Error requesting notification permission", err);
    }
  };

  const handleRequestMic = async () => {
    try {
      const res = await requestRecordingPermissionsAsync();
      const granted = res.granted;
      setMicStatus(granted ? "granted" : "denied");
      if (!granted && Platform.OS !== "web") {
        Alert.alert(
          "Microphone Permission",
          "Enable microphone access in device settings to capture thoughts and quick tasks via voice notes.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Device Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (err) {
      console.warn("Error requesting mic permission", err);
    }
  };

  const items: PermissionItem[] = [
    {
      id: "files",
      name: "Files & Documents",
      icon: (c) => <FileText size={18} color={c} />,
      why: "Lets Stride read documents you choose to add, so it can find deadlines and summarize them for you.",
      status: filesStatus,
      onRequest: handleRequestFiles,
    },
    {
      id: "photos",
      name: "Photos & Media",
      icon: (c) => <Camera size={18} color={c} />,
      why: "Lets Stride understand screenshots or photos you add — like a whiteboard photo or a receipt.",
      status: photoStatus,
      onRequest: handleRequestPhotos,
    },
    {
      id: "calendar",
      name: "Calendar (Read-Only)",
      icon: (c) => <CalendarIcon size={18} color={c} />,
      why: "Lets Stride see your upcoming events so Next Move can account for your actual schedule.",
      status: calendarStatus,
      onRequest: handleRequestCalendar,
    },
    {
      id: "notifications",
      name: "Notifications",
      icon: (c) => <Bell size={18} color={c} />,
      why: "Sends morning briefing summaries and focus timer completion cues.",
      status: notificationStatus,
      onRequest: handleRequestNotifications,
    },
    {
      id: "microphone",
      name: "Microphone",
      icon: (c) => <Mic size={18} color={c} />,
      why: "Lets you capture thoughts by voice instead of typing.",
      status: micStatus,
      onRequest: handleRequestMic,
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

      <ScrollView overScrollMode="always"
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
          {items.map((item) => {
            const isGranted = item.status === "granted";
            return (
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
                        backgroundColor: isGranted
                          ? "rgba(52, 211, 153, 0.16)"
                          : item.status === "denied"
                          ? "rgba(239, 68, 68, 0.16)"
                          : "rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      {isGranted ? (
                        <>
                          <CheckCircle2 size={11} color="#34D399" />
                          <Text className="text-[10px] font-semibold text-emerald-400">
                            Granted
                          </Text>
                        </>
                      ) : item.status === "denied" ? (
                        <>
                          <XCircle size={11} color="#EF4444" />
                          <Text className="text-[10px] font-semibold text-rose-400">
                            Denied
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
                            {isGranted ? "Test / Manage" : "Request Access"}
                          </Text>
                        </View>
                      </LiquidGlass>
                    </Pressable>
                  </View>
                </View>
              </LiquidGlass>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
