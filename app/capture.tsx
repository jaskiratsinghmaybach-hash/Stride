import { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import {
  ArrowRight,
  Camera,
  FileText,
  Mic,
  Sparkles,
  Square,
  X,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import { createTask } from "@/services/tasks/taskClient";
import { enqueueAiJob } from "@/services/ai/aiClient";
import { addAndIndexContextItem } from "@/services/vault/indexing";

export default function QuickCaptureModal() {
  const { colors } = useStrideTheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = session?.user?.id;

  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || !userId || isSubmitting) return;

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      // 1. Save low-friction task directly to storage
      const newTask = await createTask(userId, {
        title: text,
        status: "inbox",
        priority: "normal",
      });

      // 2. Enqueue extract_actions job to AI queue
      await enqueueAiJob(userId, {
        id: `capture_${Date.now()}`,
        type: "extract_actions",
        priority: "normal",
        payload: { taskId: newTask.id, rawText: text },
      });

      router.back();
    } catch (err) {
      console.warn("Failed saving captured item", err);
      setIsSubmitting(false);
    }
  };

  const handleVoiceCapture = async () => {
    if (!userId) return;

    if (isRecording) {
      // Stop recording
      try {
        const recording = recordingRef.current;
        if (!recording) return;

        setIsRecording(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        recordingRef.current = null;

        if (uri) {
          const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          await addAndIndexContextItem(userId, {
            type: "audio",
            title: `Voice Note (${timestamp})`,
            uri,
          });
          Alert.alert("Voice Captured", "Voice note saved to your Context Vault.");
          router.back();
        }
      } catch (err) {
        console.warn("Failed stopping audio recording", err);
      }
    } else {
      // Start recording
      try {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            "Microphone Permission",
            "Enable microphone access to record voice notes."
          );
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        setIsRecording(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch (err) {
        console.warn("Failed starting audio recording", err);
      }
    }
  };

  const handlePhotoCapture = async () => {
    if (!userId) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photos Permission", "Enable photo access to import images into Stride.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        await addAndIndexContextItem(userId, {
          type: "image",
          title: asset.fileName || `Photo (${new Date().toLocaleDateString()})`,
          uri: asset.uri,
          mimeType: asset.mimeType || "image/jpeg",
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.back();
      }
    } catch (err) {
      console.warn("Failed picking image", err);
    }
  };

  const handleDocCapture = async () => {
    if (!userId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: "*/*",
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        await addAndIndexContextItem(userId, {
          type: "document",
          title: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType || "application/octet-stream",
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.back();
      }
    } catch (err) {
      console.warn("Failed picking document", err);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["#12162C", "#1E1A3D", "#2C204A"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View
        className="flex-1 px-5"
        style={{
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: Math.max(insets.bottom, 16) + 20,
        }}
      >
        {/* Modal Top Bar */}
        <View className="flex-row items-center justify-between mb-6">
          <Text
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: colors.muted }}
          >
            QUICK CAPTURE
          </Text>

          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <LiquidGlass shape="pill" intensity={28}>
              <View className="h-9 w-9 items-center justify-center">
                <X size={18} color={colors.ink} />
              </View>
            </LiquidGlass>
          </Pressable>
        </View>

        {/* Text Input Surface */}
        <LiquidGlass shape="card" tone="strong" style={{ minHeight: 180 }}>
          <View className="p-4 flex-1 justify-between">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="What's on your mind? (e.g. Call architect about site survey tomorrow at 2)"
              placeholderTextColor="rgba(245, 246, 255, 0.45)"
              multiline
              autoFocus
              style={{
                color: colors.ink,
                fontSize: 16,
                lineHeight: 24,
                flex: 1,
                textAlignVertical: "top",
              }}
            />

            <View className="flex-row items-center justify-between pt-3 border-t border-white/10">
              <View className="flex-row items-center gap-1.5">
                <Sparkles size={12} color={colors.accent} />
                <Text className="text-[11px]" style={{ color: colors.muted }}>
                  AI extraction will run asynchronously
                </Text>
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={!input.trim() || isSubmitting}
                hitSlop={8}
              >
                <LiquidGlass
                  shape="pill"
                  tone={input.trim() ? "hero" : "default"}
                  style={{ opacity: input.trim() ? 1 : 0.4 }}
                >
                  <View className="flex-row items-center gap-1.5 px-4 py-2">
                    <Text className="text-xs font-semibold" style={{ color: colors.ink }}>
                      Save
                    </Text>
                    <ArrowRight size={14} color={colors.ink} />
                  </View>
                </LiquidGlass>
              </Pressable>
            </View>
          </View>
        </LiquidGlass>

        {/* Multimodal Entry Points */}
        <View className="mt-6">
          <Text
            className="mb-3 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            CAPTURE CONTEXT
          </Text>

          <View className="flex-row gap-3">
            {/* Voice Button */}
            <Pressable onPress={handleVoiceCapture} className="flex-1">
              <LiquidGlass shape="card" tone={isRecording ? "active" : "default"}>
                <View className="items-center justify-center p-3.5 gap-1.5">
                  {isRecording ? (
                    <>
                      <Square size={20} color="#EF4444" fill="#EF4444" />
                      <Text className="text-xs font-semibold text-rose-400">
                        Stop Recording
                      </Text>
                    </>
                  ) : (
                    <>
                      <Mic size={20} color={colors.accent} />
                      <Text className="text-xs font-medium" style={{ color: colors.ink }}>
                        Voice Note
                      </Text>
                    </>
                  )}
                </View>
              </LiquidGlass>
            </Pressable>

            {/* Photo Button */}
            <Pressable onPress={handlePhotoCapture} className="flex-1">
              <LiquidGlass shape="card">
                <View className="items-center justify-center p-3.5 gap-1.5">
                  <Camera size={20} color={colors.accent} />
                  <Text className="text-xs font-medium" style={{ color: colors.ink }}>
                    Snap Photo
                  </Text>
                </View>
              </LiquidGlass>
            </Pressable>

            {/* Document Picker Button */}
            <Pressable onPress={handleDocCapture} className="flex-1">
              <LiquidGlass shape="card">
                <View className="items-center justify-center p-3.5 gap-1.5">
                  <FileText size={20} color={colors.accent} />
                  <Text className="text-xs font-medium" style={{ color: colors.ink }}>
                    Add Doc
                  </Text>
                </View>
              </LiquidGlass>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
