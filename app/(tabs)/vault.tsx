import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import {
  Archive,
  ArrowRight,
  Camera,
  Check,
  FileCode,
  FileText,
  FileType,
  Folder,
  FolderPlus,
  Layers,
  Mic,
  Plus,
  Sparkles,
  Square,
  X,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { StrideScrollView } from "@/components/ui/StrideScrollView";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import type { ContextItem, ContextItemType } from "@/types/contextItem";
import type { Project } from "@/types/project";
import {
  createProject,
  getContextItems,
  getProjects,
  relateContextToTask,
} from "@/services/vault/vaultClient";
import { addAndIndexContextItem } from "@/services/vault/indexing";
import { inferContextItemType, inferDocumentFormat } from "@/services/vault/fileTypeUtils";
import {
  subscribePendingSuggestions,
  removePendingSuggestion,
  type PendingTaskSuggestion,
} from "@/services/vault/pendingSuggestions";
import { enqueueAiJob } from "@/services/ai/aiClient";
import { createTask } from "@/services/tasks/taskClient";

const FILTER_TABS: Array<{ id: ContextItemType | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "document", label: "Docs" },
  { id: "note", label: "Notes" },
  { id: "image", label: "Images" },
  { id: "audio", label: "Voice" },
  { id: "file", label: "Files" },
];

export default function VaultScreen() {
  const { colors } = useStrideTheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = session?.user?.id;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [items, setItems] = useState<ContextItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<ContextItemType | "all">("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [fabOpen, setFabOpen] = useState(false);

  const [showDump, setShowDump] = useState(false);
  const [dumpText, setDumpText] = useState("");
  const [dumpImage, setDumpImage] = useState<{ uri: string; mimeType?: string; name?: string } | null>(null);
  const [dumpAudioUri, setDumpAudioUri] = useState<string | null>(null);
  const [isDumpRecording, setIsDumpRecording] = useState(false);
  const [isDumpSubmitting, setIsDumpSubmitting] = useState(false);

  const [suggestions, setSuggestions] = useState<PendingTaskSuggestion[]>([]);

  const tabClearance = Math.max(16, insets.bottom + 6) + 72;

  const loadVaultData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    try {
      const [projs, allItems] = await Promise.all([
        getProjects(userId),
        getContextItems(userId),
      ]);
      setProjects(projs);
      setItems(allItems);
    } catch (err) {
      console.warn("Error loading vault", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadVaultData();
  }, [loadVaultData]);

  useEffect(() => {
    return subscribePendingSuggestions(setSuggestions);
  }, []);

  const handleCreateProject = async () => {
    if (!userId || !newProjectName.trim()) return;
    await createProject(userId, newProjectName.trim());
    setNewProjectName("");
    setIsAddingProject(false);
    await loadVaultData();
  };

  const handlePickDocument = async () => {
    if (!userId) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: "*/*",
      });

      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        setShowAddMenu(false);
        setFabOpen(false);
        await addAndIndexContextItem(userId, {
          title: asset.name,
          type: inferContextItemType(asset.mimeType, asset.name),
          uri: asset.uri,
          mimeType: asset.mimeType,
          projectId: selectedProjectId || undefined,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await loadVaultData();
      }
    } catch (err) {
      console.warn("Failed picking document in vault", err);
    }
  };

  const handlePickPhoto = async () => {
    if (!userId) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photos Permission", "Enable photo access to add images to your Vault.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        const filename = asset.fileName || `Photo (${new Date().toLocaleDateString()})`;
        setShowAddMenu(false);
        setFabOpen(false);
        await addAndIndexContextItem(userId, {
          title: filename,
          type: inferContextItemType(asset.mimeType || "image/jpeg", filename),
          uri: asset.uri,
          mimeType: asset.mimeType,
          projectId: selectedProjectId || undefined,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await loadVaultData();
      }
    } catch (err) {
      console.warn("Failed picking photo in vault", err);
    }
  };

  const handleSaveNote = async () => {
    if (!userId || !noteTitle.trim()) return;
    try {
      await addAndIndexContextItem(userId, {
        title: noteTitle.trim(),
        type: "note",
        notes: noteContent.trim(),
        projectId: selectedProjectId || undefined,
      });
      setNoteTitle("");
      setNoteContent("");
      setIsAddingNote(false);
      setShowAddMenu(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await loadVaultData();
    } catch (err) {
      console.warn("Failed creating note", err);
    }
  };

  const handleDumpImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photos Permission", "Enable photo access to attach an image to this dump.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        setDumpImage({
          uri: asset.uri,
          mimeType: asset.mimeType,
          name: asset.fileName || undefined,
        });
      }
    } catch (err) {
      console.warn("Dump image pick failed", err);
    }
  };

  const handleDumpVoice = async () => {
    if (isDumpRecording) {
      try {
        setIsDumpRecording(false);
        await recorder.stop();
        if (recorder.uri) setDumpAudioUri(recorder.uri);
      } catch (err) {
        console.warn("Dump recording stop failed", err);
      }
      return;
    }
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Microphone Permission", "Enable microphone access to attach a voice note.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsDumpRecording(true);
    } catch (err) {
      console.warn("Dump recording start failed", err);
    }
  };

  const handleDumpSubmit = async () => {
    if (!userId || isDumpSubmitting) return;
    const text = dumpText.trim();
    if (!text && !dumpImage && !dumpAudioUri) return;

    setIsDumpSubmitting(true);
    try {
      let created: ContextItem | null = null;

      if (dumpImage) {
        const filename = dumpImage.name || `Dump photo (${new Date().toLocaleDateString()})`;
        created = await addAndIndexContextItem(userId, {
          title: text ? text.slice(0, 72) : filename,
          type: inferContextItemType(dumpImage.mimeType || "image/jpeg", filename),
          uri: dumpImage.uri,
          mimeType: dumpImage.mimeType,
          notes: text || undefined,
          projectId: selectedProjectId || undefined,
        });
      } else if (dumpAudioUri) {
        created = await addAndIndexContextItem(userId, {
          title: text ? text.slice(0, 72) : `Voice dump (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
          type: "audio",
          uri: dumpAudioUri,
          mimeType: "audio/m4a",
          notes: text || undefined,
          projectId: selectedProjectId || undefined,
        });
      } else {
        created = await addAndIndexContextItem(userId, {
          title: text.slice(0, 72),
          type: "note",
          notes: text,
          projectId: selectedProjectId || undefined,
        });
      }

      if (dumpImage && dumpAudioUri) {
        await addAndIndexContextItem(userId, {
          title: `Voice dump (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
          type: "audio",
          uri: dumpAudioUri,
          mimeType: "audio/m4a",
          projectId: selectedProjectId || undefined,
        });
      }

      if (text) {
        await enqueueAiJob(userId, {
          id: `dump_${Date.now()}`,
          type: "suggest_actions",
          priority: "normal",
          payload: { rawText: text, contextId: created?.id },
        });
      }

      setDumpText("");
      setDumpImage(null);
      setDumpAudioUri(null);
      setShowDump(false);
      setFabOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await loadVaultData();
    } catch (err) {
      console.warn("Dump submit failed", err);
    } finally {
      setIsDumpSubmitting(false);
    }
  };

  const handleAcceptSuggestion = async (suggestion: PendingTaskSuggestion) => {
    if (!userId) return;
    const task = await createTask(userId, {
      title: suggestion.title,
      status: "inbox",
      priority: suggestion.priority,
      dueDate: suggestion.dueDate,
      projectId: suggestion.project?.startsWith("proj_") ? suggestion.project : undefined,
    });
    if (suggestion.contextId) {
      await relateContextToTask(userId, suggestion.contextId, task.id);
    }
    removePendingSuggestion(suggestion.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const filteredItems = items.filter((item) => {
    const matchesType = activeFilter === "all" || item.type === activeFilter;
    const matchesProject = !selectedProjectId || item.projectId === selectedProjectId;
    return matchesType && matchesProject;
  });

  const getItemIcon = (item: ContextItem) => {
    if (item.type === "image" && item.uri) {
      return (
        <Image
          source={{ uri: item.uri }}
          style={{ width: 40, height: 40, borderRadius: 12 }}
        />
      );
    }
    if (item.type === "note") {
      return <FileCode size={18} color={colors.spark} />;
    }
    if (item.type === "audio") {
      return <Mic size={18} color={colors.accent} />;
    }
    if (item.type === "document") {
      const format = inferDocumentFormat(item.mimeType, item.title);
      if (format === "pdf") return <FileText size={18} color={colors.accent} />;
      if (format === "docx") return <FileType size={18} color={colors.accent} />;
      return <FileText size={18} color={colors.accent} />;
    }
    return <Archive size={18} color={colors.accent} />;
  };

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

      <StrideScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: tabClearance + 88,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadVaultData}
            tintColor={colors.accent}
          />
        }
      >
        <View className="mb-6">
          <Text
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: colors.muted }}
          >
            KNOWLEDGE BASE
          </Text>
          <Text
            className="mt-1 text-2xl font-bold tracking-tight"
            style={{ color: colors.ink }}
          >
            Context Vault
          </Text>
        </View>

        {showAddMenu && (
          <View className="mb-6">
            <LiquidGlass shape="card" tone="strong">
              <View className="p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.accent }}>
                    Add Context {selectedProjectId ? `to ${projects.find((p) => p.id === selectedProjectId)?.name}` : ""}
                  </Text>
                  <Pressable onPress={() => setShowAddMenu(false)} hitSlop={8}>
                    <X size={16} color={colors.muted} />
                  </Pressable>
                </View>

                {!isAddingNote ? (
                  <View className="flex-row gap-2.5">
                    <Pressable onPress={handlePickDocument} className="flex-1">
                      <LiquidGlass shape="card">
                        <View className="items-center justify-center p-3 gap-1">
                          <FileText size={18} color={colors.accent} />
                          <Text className="text-xs font-semibold" style={{ color: colors.ink }}>
                            Document
                          </Text>
                        </View>
                      </LiquidGlass>
                    </Pressable>

                    <Pressable onPress={handlePickPhoto} className="flex-1">
                      <LiquidGlass shape="card">
                        <View className="items-center justify-center p-3 gap-1">
                          <Camera size={18} color={colors.accent} />
                          <Text className="text-xs font-semibold" style={{ color: colors.ink }}>
                            Photo
                          </Text>
                        </View>
                      </LiquidGlass>
                    </Pressable>

                    <Pressable onPress={() => setIsAddingNote(true)} className="flex-1">
                      <LiquidGlass shape="card">
                        <View className="items-center justify-center p-3 gap-1">
                          <FileCode size={18} color={colors.spark} />
                          <Text className="text-xs font-semibold" style={{ color: colors.ink }}>
                            Quick Note
                          </Text>
                        </View>
                      </LiquidGlass>
                    </Pressable>
                  </View>
                ) : (
                  <View className="gap-2.5">
                    <TextInput
                      value={noteTitle}
                      onChangeText={setNoteTitle}
                      placeholder="Note Title..."
                      placeholderTextColor={colors.muted}
                      style={{
                        color: colors.ink,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        fontSize: 13,
                      }}
                      autoFocus
                    />
                    <TextInput
                      value={noteContent}
                      onChangeText={setNoteContent}
                      placeholder="Content, takeaways, or references..."
                      placeholderTextColor={colors.muted}
                      multiline
                      style={{
                        color: colors.ink,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        fontSize: 13,
                        minHeight: 60,
                        textAlignVertical: "top",
                      }}
                    />
                    <View className="flex-row justify-end gap-2 mt-1">
                      <Pressable onPress={() => setIsAddingNote(false)} className="px-3 py-1.5">
                        <Text className="text-xs" style={{ color: colors.muted }}>
                          Cancel
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={handleSaveNote}
                        className="px-4 py-1.5 rounded-full"
                        style={{ backgroundColor: colors.accent }}
                      >
                        <Text className="text-xs font-semibold text-slate-900">
                          Save Note
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </LiquidGlass>
          </View>
        )}

        {isAddingProject && (
          <View className="mb-6">
            <LiquidGlass shape="card" tone="active">
              <View className="p-4">
                <Text className="text-xs font-semibold mb-2" style={{ color: colors.ink }}>
                  Create New Project
                </Text>
                <TextInput
                  value={newProjectName}
                  onChangeText={setNewProjectName}
                  placeholder="Project name..."
                  placeholderTextColor={colors.muted}
                  style={{
                    color: colors.ink,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 14,
                  }}
                  autoFocus
                />
                <View className="mt-3 flex-row justify-end gap-2">
                  <Pressable
                    onPress={() => setIsAddingProject(false)}
                    className="px-3 py-1.5 rounded-full"
                  >
                    <Text className="text-xs" style={{ color: colors.muted }}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleCreateProject}
                    className="px-4 py-1.5 rounded-full"
                    style={{ backgroundColor: colors.accent }}
                  >
                    <Text className="text-xs font-semibold text-slate-900">
                      Save
                    </Text>
                  </Pressable>
                </View>
              </View>
            </LiquidGlass>
          </View>
        )}

        {showDump && (
          <View className="mb-6">
            <LiquidGlass shape="card" tone="strong">
              <View className="p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.accent }}>
                    Vault Dump
                  </Text>
                  <Pressable onPress={() => setShowDump(false)} hitSlop={8}>
                    <X size={16} color={colors.muted} />
                  </Pressable>
                </View>

                <LiquidGlass shape="card">
                  <View className="px-4 py-3">
                    <TextInput
                      value={dumpText}
                      onChangeText={setDumpText}
                      placeholder="Dump what's on your mind..."
                      placeholderTextColor={colors.muted}
                      multiline
                      style={{
                        color: colors.ink,
                        fontSize: 16,
                        lineHeight: 22,
                        minHeight: 48,
                        textAlignVertical: "top",
                      }}
                    />
                  </View>
                </LiquidGlass>

                <View className="mt-3 flex-row gap-2">
                  <Pressable onPress={handleDumpVoice} className="flex-1">
                    <LiquidGlass shape="card" tone={isDumpRecording ? "active" : "default"}>
                      <View className="items-center py-2.5 gap-1">
                        {isDumpRecording ? (
                          <Square size={16} color="#EF4444" fill="#EF4444" />
                        ) : (
                          <Mic size={16} color={colors.accent} />
                        )}
                        <Text className="text-[11px] font-medium" style={{ color: colors.ink }}>
                          {isDumpRecording ? "Stop" : dumpAudioUri ? "Voice attached" : "Voice"}
                        </Text>
                      </View>
                    </LiquidGlass>
                  </Pressable>
                  <Pressable onPress={handleDumpImage} className="flex-1">
                    <LiquidGlass shape="card" tone={dumpImage ? "active" : "default"}>
                      <View className="items-center py-2.5 gap-1">
                        <Camera size={16} color={colors.accent} />
                        <Text className="text-[11px] font-medium" style={{ color: colors.ink }}>
                          {dumpImage ? "Photo attached" : "Image"}
                        </Text>
                      </View>
                    </LiquidGlass>
                  </Pressable>
                </View>

                {!dumpText.trim() && dumpAudioUri ? (
                  <Text className="mt-2 text-[11px]" style={{ color: colors.muted }}>
                    Voice is saved as audio. There is no transcription yet, so task suggestions need typed text.
                  </Text>
                ) : null}

                <Pressable
                  onPress={handleDumpSubmit}
                  disabled={isDumpSubmitting || (!dumpText.trim() && !dumpImage && !dumpAudioUri)}
                  className="mt-3"
                >
                  <LiquidGlass shape="pill" tone="hero" style={{ opacity: isDumpSubmitting ? 0.5 : 1 }}>
                    <View className="items-center py-2.5">
                      <Text className="text-xs font-semibold" style={{ color: colors.ink }}>
                        {isDumpSubmitting ? "Saving…" : "Save dump"}
                      </Text>
                    </View>
                  </LiquidGlass>
                </Pressable>
              </View>
            </LiquidGlass>
          </View>
        )}

        <View className="mb-6">
          <Text
            className="mb-2.5 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            PROJECTS
          </Text>

          <StrideScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            alwaysBounceVertical={false}
            contentContainerStyle={{ gap: 8, paddingRight: 10 }}
          >
            <Pressable onPress={() => setSelectedProjectId(null)}>
              <LiquidGlass
                shape="pill"
                tone={selectedProjectId === null ? "active" : "default"}
              >
                <View className="flex-row items-center gap-1.5 px-3.5 py-2">
                  <Layers
                    size={14}
                    color={selectedProjectId === null ? colors.ink : colors.muted}
                  />
                  <Text
                    className="text-xs font-medium"
                    style={{
                      color: selectedProjectId === null ? colors.ink : colors.muted,
                    }}
                  >
                    All Projects ({items.length})
                  </Text>
                </View>
              </LiquidGlass>
            </Pressable>

            {projects.map((proj) => {
              const isSelected = selectedProjectId === proj.id;
              const count = items.filter((i) => i.projectId === proj.id).length;
              return (
                <Pressable
                  key={proj.id}
                  onPress={() =>
                    setSelectedProjectId(isSelected ? null : proj.id)
                  }
                >
                  <LiquidGlass shape="pill" tone={isSelected ? "active" : "default"}>
                    <View className="flex-row items-center gap-1.5 px-3.5 py-2">
                      <Folder
                        size={14}
                        color={isSelected ? colors.ink : colors.muted}
                      />
                      <Text
                        className="text-xs font-medium"
                        style={{ color: isSelected ? colors.ink : colors.muted }}
                      >
                        {proj.name} ({count})
                      </Text>
                    </View>
                  </LiquidGlass>
                </Pressable>
              );
            })}
          </StrideScrollView>
        </View>

        <View className="mb-4">
          <StrideScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            alwaysBounceVertical={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveFilter(tab.id)}
                >
                  <View
                    className="rounded-full px-3 py-1.5"
                    style={{
                      backgroundColor: isActive
                        ? "rgba(139, 158, 255, 0.22)"
                        : "transparent",
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: isActive ? colors.accent : colors.muted }}
                    >
                      {tab.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </StrideScrollView>
        </View>

        <View>
          {filteredItems.length > 0 ? (
            <View className="gap-3">
              {filteredItems.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/vault/${item.id}`)}
                >
                  <LiquidGlass shape="card">
                    <View className="flex-row items-center justify-between p-4">
                      <View
                        className="mr-3.5 h-10 w-10 items-center justify-center rounded-xl overflow-hidden"
                        style={{
                          backgroundColor:
                            item.type === "note"
                              ? "rgba(255, 139, 107, 0.12)"
                              : "rgba(255,255,255,0.05)",
                        }}
                      >
                        {getItemIcon(item)}
                      </View>

                      <View className="flex-1 pr-2">
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: colors.ink }}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>

                        <View className="mt-1 flex-row items-center gap-2">
                          <Text
                            className="text-xs uppercase tracking-wide"
                            style={{
                              color: item.type === "note" ? colors.spark : colors.muted,
                            }}
                          >
                            {item.type}
                          </Text>
                          {item.aiState === "analyzed" ? (
                            <View className="flex-row items-center gap-1 rounded-full bg-indigo-500/20 px-2 py-0.5">
                              <Sparkles size={10} color={colors.accent} />
                              <Text
                                className="text-[10px] font-semibold"
                                style={{ color: colors.accent }}
                              >
                                Indexed
                              </Text>
                            </View>
                          ) : (
                            <Text
                              className="text-[10px]"
                              style={{ color: colors.muted }}
                            >
                              {item.aiState}
                            </Text>
                          )}
                        </View>
                      </View>

                      <ArrowRight size={16} color={colors.muted} />
                    </View>
                  </LiquidGlass>
                </Pressable>
              ))}
            </View>
          ) : (
            <LiquidGlass shape="card">
              <View className="items-center justify-center p-8 text-center">
                <Archive size={32} color={colors.accent} />
                <Text
                  className="mt-3 text-sm font-semibold"
                  style={{ color: colors.ink }}
                >
                  Your context will appear here.
                </Text>
                <Text
                  className="mt-1 text-xs text-center leading-5"
                  style={{ color: colors.muted }}
                >
                  Save notes, documents, and reference materials. Stride links them
                  directly to your daily priorities.
                </Text>
              </View>
            </LiquidGlass>
          )}
        </View>
      </StrideScrollView>

      {suggestions.length > 0 && (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: tabClearance + 72,
            gap: 8,
          }}
        >
          {suggestions.slice(0, 3).map((suggestion) => (
            <LiquidGlass key={suggestion.id} shape="card" tone="hero">
              <View className="p-3.5">
                <Text className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: colors.accent }}>
                  Stride suggested this
                </Text>
                <Text className="text-sm font-semibold" style={{ color: colors.ink }}>
                  {suggestion.title}
                </Text>
                {suggestion.details ? (
                  <Text className="mt-0.5 text-xs" style={{ color: colors.muted }}>
                    {suggestion.details}
                  </Text>
                ) : null}
                <View className="mt-3 flex-row gap-2">
                  <Pressable onPress={() => handleAcceptSuggestion(suggestion)} className="flex-1">
                    <View className="flex-row items-center justify-center gap-1 rounded-full py-2" style={{ backgroundColor: colors.accent }}>
                      <Check size={14} color="#12162C" />
                      <Text className="text-xs font-semibold text-slate-900">Accept</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => removePendingSuggestion(suggestion.id)} className="flex-1">
                    <View className="flex-row items-center justify-center gap-1 rounded-full py-2 bg-white/10">
                      <X size={14} color={colors.muted} />
                      <Text className="text-xs font-semibold" style={{ color: colors.muted }}>Decline</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            </LiquidGlass>
          ))}
        </View>
      )}

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: 20,
          bottom: tabClearance,
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        {fabOpen && (
          <>
            <Pressable
              onPress={() => {
                setShowDump(true);
                setShowAddMenu(false);
                setIsAddingProject(false);
                setFabOpen(false);
              }}
            >
              <LiquidGlass shape="pill" tone="hero">
                <View className="flex-row items-center gap-1.5 px-3.5 py-2">
                  <Sparkles size={14} color={colors.ink} />
                  <Text className="text-xs font-semibold" style={{ color: colors.ink }}>Dump</Text>
                </View>
              </LiquidGlass>
            </Pressable>
            <Pressable
              onPress={() => {
                setIsAddingProject(true);
                setShowAddMenu(false);
                setShowDump(false);
                setFabOpen(false);
              }}
            >
              <LiquidGlass shape="pill">
                <View className="flex-row items-center gap-1.5 px-3.5 py-2">
                  <FolderPlus size={14} color={colors.ink} />
                  <Text className="text-xs font-semibold" style={{ color: colors.ink }}>Project</Text>
                </View>
              </LiquidGlass>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowAddMenu(true);
                setIsAddingProject(false);
                setShowDump(false);
                setFabOpen(false);
              }}
            >
              <LiquidGlass shape="pill">
                <View className="flex-row items-center gap-1.5 px-3.5 py-2">
                  <Plus size={14} color={colors.ink} />
                  <Text className="text-xs font-semibold" style={{ color: colors.ink }}>Add</Text>
                </View>
              </LiquidGlass>
            </Pressable>
          </>
        )}
        <Pressable
          onPress={() => setFabOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel="Vault actions"
        >
          <LiquidGlass shape="pill" tone="hero">
            <View className="h-14 w-14 items-center justify-center">
              {fabOpen ? <X size={22} color={colors.ink} /> : <Plus size={22} color={colors.ink} />}
            </View>
          </LiquidGlass>
        </Pressable>
      </View>
    </View>
  );
}
