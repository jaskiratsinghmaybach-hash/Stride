import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Folder,
  ListPlus,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { StrideScrollView } from "@/components/ui/StrideScrollView";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import type { ContextItem } from "@/types/contextItem";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";
import { deleteContextItem, getContextItem, getProjects, updateContextItem } from "@/services/vault/vaultClient";
import { getTasks, createTask } from "@/services/tasks/taskClient";
import { enqueueAiJob } from "@/services/ai/aiClient";
import { enqueueUnderstandImageJob } from "@/services/vault/indexing";
import { isAppOwnedUri, renameOwnedFile } from "@/services/vault/fileTypeUtils";

export default function ContextItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useStrideTheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = session?.user?.id;

  const [item, setItem] = useState<ContextItem | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [relatedTasks, setRelatedTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const loadItem = useCallback(async () => {
    if (!userId || !id) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await getContextItem(userId, id);
      setItem(data);

      if (data?.projectId) {
        const projs = await getProjects(userId);
        const p = projs.find((pr) => pr.id === data.projectId);
        setProject(p ?? null);
      }

      if (data?.relatedTaskIds && data.relatedTaskIds.length > 0) {
        const allTasks = await getTasks(userId);
        setRelatedTasks(allTasks.filter((t) => data.relatedTaskIds?.includes(t.id)));
      }
    } catch (err) {
      console.warn("Failed loading context item", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, id]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const handleSummarize = async () => {
    if (!item || !userId) return;
    setIsSummarizing(true);
    setStatusNotice("Queuing analysis in AI worker...");

    try {
      if (item.type === "image") {
        await enqueueUnderstandImageJob(userId, item);
      } else {
        await enqueueAiJob(userId, {
          id: `job_${Date.now()}`,
          type: "understand_document",
          priority: "normal",
          payload: {
            contextId: item.id,
            title: item.title,
            text: item.extractedText || item.notes || item.title,
          },
        });
      }

      // Update state honestly to 'analyzing'
      const updated = await updateContextItem(userId, item.id, {
        aiState: "analyzing",
      });
      if (updated) setItem(updated);
      setStatusNotice("Job queued. Worker will process when connected.");
    } catch (err) {
      console.warn("Failed queuing AI job", err);
      setStatusNotice("Failed to enqueue AI job.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleCreateTaskFromContext = async () => {
    if (!item || !userId) return;
    try {
      const task = await createTask(userId, {
        title: `Review ${item.title}`,
        description: `Follow up on context item: ${item.title}`,
        status: "planned",
        priority: "normal",
        projectId: item.projectId,
        relatedContextIds: [item.id],
      });
      setStatusNotice(`Created task: "${task.title}"`);
      await loadItem();
    } catch (err) {
      console.warn("Error creating task", err);
    }
  };

  const handleRename = async () => {
    if (!item || !userId || !renameValue.trim()) return;
    const nextTitle = renameValue.trim();
    try {
      let notice = `Renamed in-app title to “${nextTitle}”.`;
      let nextUri = item.uri;
      if (item.uri && isAppOwnedUri(item.uri)) {
        const moved = await renameOwnedFile(item.uri, nextTitle);
        if (moved) {
          nextUri = moved;
          notice = `Renamed the in-app record and the file Stride stores to “${nextTitle}”.`;
        } else {
          notice = `Updated the in-app title to “${nextTitle}”. The stored file name could not be changed.`;
        }
      } else if (item.uri) {
        notice = `Updated the in-app title to “${nextTitle}”. This file lives outside Stride, so the original filename was left unchanged.`;
      }
      const updated = await updateContextItem(userId, item.id, {
        title: nextTitle,
        uri: nextUri,
      });
      if (updated) setItem(updated);
      setIsRenaming(false);
      setStatusNotice(notice);
    } catch (err) {
      console.warn("Rename failed", err);
      setStatusNotice("Rename failed.");
    }
  };

  const handleDelete = () => {
    if (!item || !userId) return;
    Alert.alert("Delete this item?", "This removes it from your Vault. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const owned = isAppOwnedUri(item.uri);
          const ok = await deleteContextItem(userId, item.id);
          if (ok) {
            router.back();
            Alert.alert(
              "Deleted",
              owned
                ? "Removed the Vault record and Stride’s local copy of the file."
                : "Removed the Vault record. The original file outside Stride was not deleted."
            );
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#12162C]">
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-[#12162C] px-6">
        <Text className="text-base font-semibold" style={{ color: colors.ink }}>
          Context item not found.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-sm font-semibold" style={{ color: colors.accent }}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

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
          paddingBottom: 40,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation Bar */}
        <View className="mb-6 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back to vault"
          >
            <LiquidGlass shape="pill" intensity={28}>
              <View className="h-10 w-10 items-center justify-center">
                <ArrowLeft size={18} color={colors.ink} />
              </View>
            </LiquidGlass>
          </Pressable>

          <View className="flex-row items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
            <Text className="text-xs uppercase font-semibold" style={{ color: colors.muted }}>
              {item.type}
            </Text>
          </View>
        </View>

        {/* Title & Metadata */}
        <Text className="text-2xl font-bold leading-8" style={{ color: colors.ink }}>
          {item.title}
        </Text>

        {item.type === "image" && item.uri ? (
          <Image
            source={{ uri: item.uri }}
            style={{ width: "100%", height: 180, borderRadius: 16, marginTop: 16 }}
            resizeMode="cover"
          />
        ) : null}

        <View className="mt-2 flex-row items-center gap-3">
          <Text className="text-xs" style={{ color: colors.muted }}>
            Added {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          {project && (
            <View className="flex-row items-center gap-1">
              <Folder size={12} color={colors.accent} />
              <Text className="text-xs font-medium" style={{ color: colors.accent }}>
                {project.name}
              </Text>
            </View>
          )}
        </View>

        {statusNotice && (
          <View className="mt-4 rounded-xl bg-indigo-500/20 p-3">
            <Text className="text-xs font-medium" style={{ color: colors.ink }}>
              {statusNotice}
            </Text>
          </View>
        )}

        {/* AI ANALYSIS SECTION (Truthful per spec) */}
        <View className="mt-6">
          <Text
            className="mb-2 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            INTELLIGENCE & REASONING
          </Text>

          <LiquidGlass shape="card">
            <View className="p-4">
              {item.aiState === "analyzed" && item.aiSummary ? (
                <View>
                  <View className="flex-row items-center gap-2 mb-2">
                    <Sparkles size={16} color={colors.accent} />
                    <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.accent }}>
                      Stride Understood Context
                    </Text>
                  </View>
                  <Text className="text-sm leading-6" style={{ color: colors.ink }}>
                    {item.aiSummary}
                  </Text>
                </View>
              ) : item.aiState === "analyzing" ? (
                <View className="flex-row items-center gap-3 py-2">
                  <ActivityIndicator size="small" color={colors.accent} />
                  <View className="flex-1">
                    <Text className="text-sm font-medium" style={{ color: colors.ink }}>
                      Analysis in progress...
                    </Text>
                    <Text className="text-xs" style={{ color: colors.muted }}>
                      The AI background queue has scheduled reasoning for this document.
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="py-2">
                  <Text className="text-sm font-medium" style={{ color: colors.ink }}>
                    {item.aiState === "unavailable"
                      ? "AI reasoning is currently unavailable."
                      : "Not yet indexed by Stride."}
                  </Text>
                  <Text className="mt-1 text-xs leading-5" style={{ color: colors.muted }}>
                    Stride extracts actionable commitments, related projects, and reference summaries when indexed.
                  </Text>
                </View>
              )}
            </View>
          </LiquidGlass>
        </View>

        {/* ACTIONS ROW */}
        <View className="mt-6">
          <Text
            className="mb-2 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            ACTIONS
          </Text>

          <View className="gap-2.5">
            <Pressable onPress={handleSummarize} disabled={isSummarizing}>
              <LiquidGlass shape="card">
                <View className="flex-row items-center justify-between p-3.5">
                  <View className="flex-row items-center gap-3">
                    <Sparkles size={18} color={colors.accent} />
                    <Text className="text-sm font-medium" style={{ color: colors.ink }}>
                      Summarize & Extract Tasks
                    </Text>
                  </View>
                  <Text className="text-xs" style={{ color: colors.muted }}>
                    AI Queue
                  </Text>
                </View>
              </LiquidGlass>
            </Pressable>

            <Pressable onPress={handleCreateTaskFromContext}>
              <LiquidGlass shape="card">
                <View className="flex-row items-center justify-between p-3.5">
                  <View className="flex-row items-center gap-3">
                    <ListPlus size={18} color={colors.accent} />
                    <Text className="text-sm font-medium" style={{ color: colors.ink }}>
                      Create Connected Task
                    </Text>
                  </View>
                  <Text className="text-xs" style={{ color: colors.muted }}>
                    New Task
                  </Text>
                </View>
              </LiquidGlass>
            </Pressable>

            <Pressable onPress={() => {
              setRenameValue(item.title);
              setIsRenaming(true);
            }}>
              <LiquidGlass shape="card">
                <View className="flex-row items-center justify-between p-3.5">
                  <View className="flex-row items-center gap-3">
                    <Pencil size={18} color={colors.accent} />
                    <Text className="text-sm font-medium" style={{ color: colors.ink }}>
                      Rename
                    </Text>
                  </View>
                  <Text className="text-xs" style={{ color: colors.muted }}>
                    Title{item.uri && isAppOwnedUri(item.uri) ? " + file" : ""}
                  </Text>
                </View>
              </LiquidGlass>
            </Pressable>

            {isRenaming && (
              <LiquidGlass shape="card" tone="active">
                <View className="p-3.5 gap-2">
                  <TextInput
                    value={renameValue}
                    onChangeText={setRenameValue}
                    autoFocus
                    placeholder="New name"
                    placeholderTextColor={colors.muted}
                    style={{
                      color: colors.ink,
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 14,
                    }}
                  />
                  <View className="flex-row justify-end gap-2">
                    <Pressable onPress={() => setIsRenaming(false)} className="px-3 py-1.5">
                      <Text className="text-xs" style={{ color: colors.muted }}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={handleRename} className="px-4 py-1.5 rounded-full" style={{ backgroundColor: colors.accent }}>
                      <Text className="text-xs font-semibold text-slate-900">Save name</Text>
                    </Pressable>
                  </View>
                </View>
              </LiquidGlass>
            )}

            <Pressable onPress={handleDelete}>
              <LiquidGlass shape="card">
                <View className="flex-row items-center justify-between p-3.5">
                  <View className="flex-row items-center gap-3">
                    <Trash2 size={18} color={colors.spark} />
                    <Text className="text-sm font-medium" style={{ color: colors.ink }}>
                      Delete
                    </Text>
                  </View>
                  <Text className="text-xs" style={{ color: colors.muted }}>
                    Confirm
                  </Text>
                </View>
              </LiquidGlass>
            </Pressable>
          </View>
        </View>

        {/* RELATED TASKS */}
        <View className="mt-6">
          <Text
            className="mb-2 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            CONNECTED TASKS
          </Text>

          {relatedTasks.length > 0 ? (
            <View className="gap-2">
              {relatedTasks.map((t) => (
                <Pressable key={t.id} onPress={() => router.push(`/task/${t.id}`)}>
                  <LiquidGlass shape="card">
                    <View className="flex-row items-center justify-between p-3.5">
                      <Text className="text-sm font-medium flex-1 pr-2" style={{ color: colors.ink }}>
                        {t.title}
                      </Text>
                      <View className="rounded-full bg-white/10 px-2 py-0.5">
                        <Text className="text-[10px] uppercase font-semibold" style={{ color: colors.muted }}>
                          {t.status}
                        </Text>
                      </View>
                    </View>
                  </LiquidGlass>
                </Pressable>
              ))}
            </View>
          ) : (
            <LiquidGlass shape="card">
              <View className="p-4 items-center justify-center">
                <Text className="text-xs" style={{ color: colors.muted }}>
                  No tasks connected directly to this item yet.
                </Text>
              </View>
            </LiquidGlass>
          )}
        </View>
      </StrideScrollView>
    </View>
  );
}
