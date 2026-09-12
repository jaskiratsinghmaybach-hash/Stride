import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import {
  ArrowLeft,
  Bot,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  Folder,
  ListPlus,
  Sparkles,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import type { ContextItem } from "@/types/contextItem";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";
import { deleteContextItem, getContextItem, getProjects, updateContextItem } from "@/services/vault/vaultClient";
import { getTasks, createTask } from "@/services/tasks/taskClient";
import { enqueueAiJob } from "@/services/ai/aiClient";

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
      const imagePayload = item.type === "image" && item.uri && item.mimeType
        ? {
            imageBase64: await FileSystem.readAsStringAsync(item.uri, {
              encoding: FileSystem.EncodingType.Base64,
            }),
            mimeType: item.mimeType,
          }
        : {};
      await enqueueAiJob({
        id: `job_${Date.now()}`,
        type: item.type === "image" ? "understand_image" : "understand_document",
        priority: "normal",
        payload: { contextId: item.id, title: item.title, ...imagePayload },
      });

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

  const handleRename = () => {
    if (!item || !userId) return;
    Alert.prompt("Rename context", "Give this item a clearer name.", async (value) => {
      const title = value?.trim();
      if (!title) return;
      let nextUri = item.uri;
      if (item.uri?.startsWith("file://")) {
        const lastSlash = item.uri.lastIndexOf("/");
        const oldName = item.uri.slice(lastSlash + 1);
        const extension = oldName.includes(".") ? oldName.slice(oldName.lastIndexOf(".")) : "";
        const target = `${item.uri.slice(0, lastSlash + 1)}${title.replace(/[\\/:*?"<>|]/g, "_")}${extension}`;
        try {
          await FileSystem.moveAsync({ from: item.uri, to: target });
          nextUri = target;
        } catch (error) {
          console.warn("Unable to rename owned local file", error);
        }
      }
      const updated = await updateContextItem(userId, item.id, { title, uri: nextUri });
      if (updated) {
        setItem(updated);
        setStatusNotice(nextUri === item.uri ? "Name updated locally; the source file could not be renamed." : "Name and local file updated; queued for sync.");
      }
    }, "plain-text", item.title);
  };

  const handleDelete = () => {
    if (!item || !userId) return;
    Alert.alert("Delete context item?", "This removes the local item and queues its deletion for sync.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteContextItem(userId, item.id);
        router.back();
      }},
    ]);
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

      <ScrollView
        className="flex-1"
        overScrollMode="always"
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
        <View className="mt-4 flex-row gap-2">
          <Pressable onPress={handleRename} className="rounded-full bg-white/10 px-3 py-2">
            <Text className="text-xs font-semibold" style={{ color: colors.ink }}>Rename</Text>
          </Pressable>
          <Pressable onPress={handleDelete} className="rounded-full bg-red-500/20 px-3 py-2">
            <Text className="text-xs font-semibold text-red-200">Delete</Text>
          </Pressable>
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

            <Pressable
              onPress={() =>
                setStatusNotice("Ask Stride conversational seam ready for Gemini integration.")
              }
            >
              <LiquidGlass shape="card">
                <View className="flex-row items-center justify-between p-3.5">
                  <View className="flex-row items-center gap-3">
                    <Bot size={18} color={colors.accent} />
                    <Text className="text-sm font-medium" style={{ color: colors.ink }}>
                      Ask Stride About This
                    </Text>
                  </View>
                  <Text className="text-xs" style={{ color: colors.muted }}>
                    Query
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
      </ScrollView>
    </View>
  );
}
