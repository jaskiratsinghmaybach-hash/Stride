import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Folder,
  Search,
  Sparkles,
  X,
} from "lucide-react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
import type { SearchResults } from "@/services/search/searchClient";
import { searchLocalStride } from "@/services/search/searchClient";

export default function SearchScreen() {
  const { colors } = useStrideTheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = session?.user?.id;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    tasks: [],
    projects: [],
    contextItems: [],
  });

  useEffect(() => {
    if (!userId || !query.trim()) {
      setResults({ tasks: [], projects: [], contextItems: [] });
      return;
    }

    const timer = setTimeout(() => {
      searchLocalStride(userId, query).then(setResults);
    }, 150);

    return () => clearTimeout(timer);
  }, [userId, query]);

  const totalResults =
    results.tasks.length + results.projects.length + results.contextItems.length;

  return (
    <View className="flex-1">
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["#12162C", "#1B1E3F", "#2A2756"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View
        className="flex-1 px-5"
        style={{
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: 20,
        }}
      >
        {/* Search Header Bar */}
        <View className="flex-row items-center gap-3 mb-4">
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <LiquidGlass shape="pill" intensity={28}>
              <View className="h-10 w-10 items-center justify-center">
                <ArrowLeft size={18} color={colors.ink} />
              </View>
            </LiquidGlass>
          </Pressable>

          <View className="flex-1">
            <LiquidGlass shape="pill" intensity={32}>
              <View className="flex-row items-center px-3.5 py-1.5">
                <Search size={16} color={colors.muted} className="mr-2" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search tasks, projects, context..."
                  placeholderTextColor={colors.muted}
                  autoFocus
                  style={{
                    color: colors.ink,
                    fontSize: 14,
                    flex: 1,
                    paddingVertical: 6,
                  }}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery("")} hitSlop={8}>
                    <X size={14} color={colors.muted} />
                  </Pressable>
                )}
              </View>
            </LiquidGlass>
          </View>
        </View>

        {/* Results List */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {query.trim().length > 0 && (
            <View className="mb-4">
              <Text className="text-xs" style={{ color: colors.muted }}>
                {totalResults} {totalResults === 1 ? "result" : "results"} found
              </Text>
            </View>
          )}

          {/* TASKS */}
          {results.tasks.length > 0 && (
            <View className="mb-5">
              <Text
                className="mb-2 text-xs font-semibold tracking-wider uppercase"
                style={{ color: colors.muted }}
              >
                TASKS ({results.tasks.length})
              </Text>
              <View className="gap-2">
                {results.tasks.map((task) => (
                  <Pressable
                    key={task.id}
                    onPress={() => router.push(`/task/${task.id}`)}
                  >
                    <LiquidGlass shape="card">
                      <View className="flex-row items-center justify-between p-3.5">
                        <View className="flex-1 pr-2">
                          <Text
                            className="text-sm font-medium"
                            style={{ color: colors.ink }}
                            numberOfLines={1}
                          >
                            {task.title}
                          </Text>
                          {task.description ? (
                            <Text
                              className="mt-0.5 text-xs"
                              style={{ color: colors.muted }}
                              numberOfLines={1}
                            >
                              {task.description}
                            </Text>
                          ) : null}
                        </View>
                        <View className="rounded-full bg-white/10 px-2 py-0.5">
                          <Text
                            className="text-[10px] uppercase font-semibold"
                            style={{ color: colors.muted }}
                          >
                            {task.status}
                          </Text>
                        </View>
                      </View>
                    </LiquidGlass>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* PROJECTS */}
          {results.projects.length > 0 && (
            <View className="mb-5">
              <Text
                className="mb-2 text-xs font-semibold tracking-wider uppercase"
                style={{ color: colors.muted }}
              >
                PROJECTS ({results.projects.length})
              </Text>
              <View className="gap-2">
                {results.projects.map((p) => (
                  <LiquidGlass key={p.id} shape="card">
                    <View className="flex-row items-center gap-3 p-3.5">
                      <Folder size={16} color={colors.accent} />
                      <Text
                        className="text-sm font-medium"
                        style={{ color: colors.ink }}
                      >
                        {p.name}
                      </Text>
                    </View>
                  </LiquidGlass>
                ))}
              </View>
            </View>
          )}

          {/* CONTEXT ITEMS */}
          {results.contextItems.length > 0 && (
            <View className="mb-5">
              <Text
                className="mb-2 text-xs font-semibold tracking-wider uppercase"
                style={{ color: colors.muted }}
              >
                CONTEXT ITEMS ({results.contextItems.length})
              </Text>
              <View className="gap-2">
                {results.contextItems.map((ci) => (
                  <Pressable
                    key={ci.id}
                    onPress={() => router.push(`/vault/${ci.id}`)}
                  >
                    <LiquidGlass shape="card">
                      <View className="flex-row items-center gap-3 p-3.5">
                        <FileText size={16} color={colors.accent} />
                        <View className="flex-1 pr-2">
                          <Text
                            className="text-sm font-medium"
                            style={{ color: colors.ink }}
                            numberOfLines={1}
                          >
                            {ci.title}
                          </Text>
                          <Text
                            className="mt-0.5 text-xs uppercase"
                            style={{ color: colors.muted }}
                          >
                            {ci.type}
                          </Text>
                        </View>
                      </View>
                    </LiquidGlass>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {query.trim().length > 0 && totalResults === 0 && (
            <LiquidGlass shape="card">
              <View className="items-center justify-center p-8 text-center">
                <Search size={28} color={colors.accent} />
                <Text
                  className="mt-3 text-sm font-semibold"
                  style={{ color: colors.ink }}
                >
                  No matches found for &quot;{query}&quot;
                </Text>
                <Text
                  className="mt-1 text-xs text-center"
                  style={{ color: colors.muted }}
                >
                  Check your spelling or try searching for another term.
                </Text>
              </View>
            </LiquidGlass>
          )}

          {/* Semantic Search Upgrade Seam Callout */}
          <View className="mt-8 mb-4">
            <LiquidGlass shape="card">
              <View className="p-4 flex-row items-center gap-3">
                <Sparkles size={16} color={colors.accent} />
                <View className="flex-1">
                  <Text className="text-xs font-semibold" style={{ color: colors.ink }}>
                    Local Substring Matching
                  </Text>
                  <Text className="text-[11px] mt-0.5" style={{ color: colors.muted }}>
                    Neural embedding search will link concepts and semantic meanings
                    in a future intelligence pass.
                  </Text>
                </View>
              </View>
            </LiquidGlass>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
