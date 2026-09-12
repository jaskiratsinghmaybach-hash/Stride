import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
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
  Archive,
  ArrowRight,
  Camera,
  FileCode,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  Layers,
  Mic,
  Plus,
  Sparkles,
  X,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import type { ContextItem, ContextItemType } from "@/types/contextItem";
import type { Project } from "@/types/project";
import {
  createProject,
  getContextItems,
  getProjects,
} from "@/services/vault/vaultClient";
import { addAndIndexContextItem } from "@/services/vault/indexing";

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

  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [items, setItems] = useState<ContextItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<ContextItemType | "all">("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Quick inline project create state
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Context add menu state
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

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
        await addAndIndexContextItem(userId, {
          title: asset.name,
          type: "document",
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
        setShowAddMenu(false);
        await addAndIndexContextItem(userId, {
          title: asset.fileName || `Photo (${new Date().toLocaleDateString()})`,
          type: "image",
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

  const filteredItems = items.filter((item) => {
    const matchesType = activeFilter === "all" || item.type === activeFilter;
    const matchesProject = !selectedProjectId || item.projectId === selectedProjectId;
    return matchesType && matchesProject;
  });

  const getItemIcon = (type: ContextItemType) => {
    switch (type) {
      case "document":
        return <FileText size={18} color={colors.accent} />;
      case "image":
        return <FileImage size={18} color={colors.accent} />;
      case "note":
        return <FileCode size={18} color={colors.accent} />;
      case "audio":
        return <Mic size={18} color={colors.accent} />;
      default:
        return <Archive size={18} color={colors.accent} />;
    }
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

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: 110,
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
        {/* Header */}
        <View className="mb-6 flex-row items-center justify-between">
          <View>
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

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setShowAddMenu(!showAddMenu)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add context"
            >
              <LiquidGlass shape="pill" tone="hero" intensity={28}>
                <View className="flex-row items-center gap-1.5 px-3 py-2">
                  <Plus size={16} color={colors.ink} />
                  <Text className="text-xs font-semibold" style={{ color: colors.ink }}>
                    Add
                  </Text>
                </View>
              </LiquidGlass>
            </Pressable>

            <Pressable
              onPress={() => setIsAddingProject(!isAddingProject)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="New project"
            >
              <LiquidGlass shape="pill" intensity={28}>
                <View className="flex-row items-center gap-1.5 px-3 py-2">
                  <FolderPlus size={16} color={colors.ink} />
                  <Text className="text-xs font-semibold" style={{ color: colors.ink }}>
                    Project
                  </Text>
                </View>
              </LiquidGlass>
            </Pressable>
          </View>
        </View>

        {/* Add Context Action Dropdown */}
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
                          <FileCode size={18} color={colors.accent} />
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

        {/* Inline New Project Form */}
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

        {/* PROJECTS SECTION */}
        <View className="mb-6">
          <Text
            className="mb-2.5 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            PROJECTS
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
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
          </ScrollView>
        </View>

        {/* SECONDARY FILTER TABS */}
        <View className="mb-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
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
          </ScrollView>
        </View>

        {/* CONTEXT ITEMS LIST */}
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
                      <View className="mr-3.5 h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                        {getItemIcon(item.type)}
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
                            style={{ color: colors.muted }}
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
      </ScrollView>
    </View>
  );
}
