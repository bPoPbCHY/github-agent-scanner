import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { Ionicons } from "@expo/vector-icons";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

interface ProgressItem {
  id: number;
  project_id: number;
  title: string;
  status: "not_started" | "in_progress" | "completed";
  progress_percentage: number;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface Project {
  id: number;
  name: string;
  repo_name: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  not_started: { label: "未开始", color: "#64748B", icon: "ellipse-outline" },
  in_progress: { label: "进行中", color: "#00F0FF", icon: "sync-outline" },
  completed: { label: "已完成", color: "#22C55E", icon: "checkmark-circle" },
};

export default function ProgressScreen() {
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ProgressItem | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formStatus, setFormStatus] = useState<"not_started" | "in_progress" | "completed">("not_started");
  const [formProgress, setFormProgress] = useState("0");
  const [formNotes, setFormNotes] = useState("");
  const [formProjectId, setFormProjectId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [progressRes, projectsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/progress`),
        fetch(`${BACKEND_URL}/api/v1/projects`),
      ]);
      const progressData = await progressRes.json();
      const projectsData = await projectsRes.json();
      setItems(progressData.data || []);
      setProjects(projectsData.data || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const openAddModal = () => {
    setEditingItem(null);
    setFormTitle("");
    setFormStatus("not_started");
    setFormProgress("0");
    setFormNotes("");
    setFormProjectId(selectedProjectId || (projects[0]?.id ?? null));
    setModalVisible(true);
  };

  const openEditModal = (item: ProgressItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormStatus(item.status);
    setFormProgress(String(item.progress_percentage));
    setFormNotes(item.notes || "");
    setFormProjectId(item.project_id);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      Alert.alert("错误", "请输入学习标题");
      return;
    }
    if (!formProjectId) {
      Alert.alert("错误", "请选择关联项目");
      return;
    }

    setSaving(true);
    try {
      const body: any = {
        project_id: formProjectId,
        title: formTitle.trim(),
        status: formStatus,
        progress_percentage: Math.min(100, Math.max(0, parseInt(formProgress, 10) || 0)),
        notes: formNotes.trim() || null,
      };

      if (formStatus === "in_progress" && !editingItem) {
        body.started_at = new Date().toISOString();
      }
      if (formStatus === "completed") {
        body.completed_at = new Date().toISOString();
      }

      if (editingItem) {
        await fetch(`${BACKEND_URL}/api/v1/progress/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await fetch(`${BACKEND_URL}/api/v1/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      setModalVisible(false);
      fetchData();
    } catch (error) {
      Alert.alert("错误", "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: ProgressItem) => {
    Alert.alert("确认删除", `确定要删除「${item.title}」吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await fetch(`${BACKEND_URL}/api/v1/progress/${item.id}`, {
              method: "DELETE",
            });
            fetchData();
          } catch (error) {
            Alert.alert("错误", "删除失败");
          }
        },
      },
    ]);
  };

  const getProjectName = (projectId: number) => {
    const project = projects.find((p) => p.id === projectId);
    return project ? project.name : `项目 #${projectId}`;
  };

  const renderProgressBar = (percentage: number, status: string) => {
    const color = STATUS_CONFIG[status]?.color || "#64748B";
    return (
      <View className="w-full h-2 bg-gray-800 rounded-full mt-2 overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, percentage))}%`,
            backgroundColor: color,
          }}
        />
      </View>
    );
  };

  const renderItem = ({ item }: { item: ProgressItem }) => {
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.not_started;
    return (
      <TouchableOpacity
        onPress={() => openEditModal(item)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
        className="bg-gray-900 rounded-2xl p-4 mb-3 border border-gray-800"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-white text-base font-semibold" numberOfLines={1}>
              {item.title}
            </Text>
            <Text className="text-gray-500 text-xs mt-1">
              {getProjectName(item.project_id)}
            </Text>
          </View>
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: config.color + "20" }}
          >
            <Text className="text-xs font-medium" style={{ color: config.color }}>
              {config.label}
            </Text>
          </View>
        </View>

        {renderProgressBar(item.progress_percentage, item.status)}

        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-gray-500 text-xs">
            {item.progress_percentage}%
          </Text>
          {item.notes ? (
            <Text className="text-gray-600 text-xs flex-1 ml-3" numberOfLines={1}>
              {item.notes}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const completedCount = items.filter((i) => i.status === "completed").length;
  const inProgressCount = items.filter((i) => i.status === "in_progress").length;
  const totalProgress = items.length > 0
    ? Math.round((completedCount / items.length) * 100)
    : 0;

  return (
    <Screen>
      <View className="flex-1 bg-black px-4 pt-4">
        {/* Header Stats */}
        <View className="mb-4">
          <Text className="text-white text-2xl font-bold mb-1">学习进度</Text>
          <Text className="text-gray-500 text-sm">
            {items.length} 个学习项 · {completedCount} 已完成 · {inProgressCount} 进行中
          </Text>
          {items.length > 0 && (
            <View className="mt-3">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-gray-400 text-xs">总体进度</Text>
                <Text className="text-cyan-400 text-xs font-bold">{totalProgress}%</Text>
              </View>
              <View className="w-full h-3 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${totalProgress}%`,
                    backgroundColor: "#00F0FF",
                  }}
                />
              </View>
            </View>
          )}
        </View>

        {/* Project Filter */}
        {projects.length > 0 && (
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
            <TouchableOpacity
              onPress={() => setSelectedProjectId(null)}
              className={`px-4 py-2 rounded-full mr-2 border ${
                selectedProjectId === null
                  ? "bg-cyan-500/20 border-cyan-500"
                  : "bg-gray-900 border-gray-800"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  selectedProjectId === null ? "text-cyan-400" : "text-gray-400"
                }`}
              >
                全部
              </Text>
            </TouchableOpacity>
            {projects.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedProjectId(p.id)}
                className={`px-4 py-2 rounded-full mr-2 border ${
                  selectedProjectId === p.id
                    ? "bg-purple-500/20 border-purple-500"
                    : "bg-gray-900 border-gray-800"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    selectedProjectId === p.id ? "text-purple-400" : "text-gray-400"
                  }`}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          </View>
        )}

        {/* List */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#00F0FF" />
          </View>
        ) : items.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="school-outline" size={64} color="#333" />
            <Text className="text-gray-600 text-base mt-4">还没有学习记录</Text>
            <Text className="text-gray-700 text-sm mt-1">点击右下角按钮添加</Text>
          </View>
        ) : (
          <FlatList
            data={
              selectedProjectId
                ? items.filter((i) => i.project_id === selectedProjectId)
                : items
            }
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}

        {/* Add Button */}
        <TouchableOpacity
          onPress={openAddModal}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-cyan-500 items-center justify-center"
          style={{
            shadowColor: "#00F0FF",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <Ionicons name="add" size={28} color="#000" />
        </TouchableOpacity>

        {/* Modal */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === "web"}>
            <KeyboardAvoidingView
              className="flex-1"
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View className="flex-1 justify-end bg-black/70">
                <View className="bg-gray-950 rounded-t-3xl p-6 max-h-[85%]">
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-6">
                      <Text className="text-white text-xl font-bold">
                        {editingItem ? "编辑进度" : "新增学习项"}
                      </Text>
                      <TouchableOpacity onPress={() => setModalVisible(false)}>
                        <Ionicons name="close" size={24} color="#666" />
                      </TouchableOpacity>
                    </View>

                    {/* Project Selector */}
                    <Text className="text-gray-400 text-xs mb-2 font-medium">关联项目</Text>
                    <View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="mb-4"
                      >
                      {projects.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => setFormProjectId(p.id)}
                          className={`px-4 py-2 rounded-full mr-2 border ${
                            formProjectId === p.id
                              ? "bg-purple-500/20 border-purple-500"
                              : "bg-gray-900 border-gray-800"
                          }`}
                        >
                          <Text
                            className={`text-xs font-medium ${
                              formProjectId === p.id ? "text-purple-400" : "text-gray-400"
                            }`}
                          >
                            {p.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    </View>

                    {/* Title */}
                    <Text className="text-gray-400 text-xs mb-2 font-medium">学习标题</Text>
                    <TextInput
                      className="bg-gray-900 text-white rounded-xl px-4 py-3 mb-4 border border-gray-800"
                      placeholder="例如：理解 Agent 架构设计"
                      placeholderTextColor="#555"
                      value={formTitle}
                      onChangeText={setFormTitle}
                    />

                    {/* Status */}
                    <Text className="text-gray-400 text-xs mb-2 font-medium">状态</Text>
                    <View className="flex-row mb-4 gap-2">
                      {(["not_started", "in_progress", "completed"] as const).map((s) => {
                        const cfg = STATUS_CONFIG[s];
                        return (
                          <TouchableOpacity
                            key={s}
                            onPress={() => setFormStatus(s)}
                            className={`flex-1 py-3 rounded-xl items-center border ${
                              formStatus === s
                                ? "border-current"
                                : "bg-gray-900 border-gray-800"
                            }`}
                            style={
                              formStatus === s
                                ? { backgroundColor: cfg.color + "15", borderColor: cfg.color }
                                : {}
                            }
                          >
                            <Ionicons
                              name={cfg.icon as any}
                              size={18}
                              color={formStatus === s ? cfg.color : "#555"}
                            />
                            <Text
                              className="text-xs mt-1"
                              style={{ color: formStatus === s ? cfg.color : "#555" }}
                            >
                              {cfg.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Progress Percentage */}
                    <Text className="text-gray-400 text-xs mb-2 font-medium">
                      完成度 ({formProgress}%)
                    </Text>
                    <TextInput
                      className="bg-gray-900 text-white rounded-xl px-4 py-3 mb-4 border border-gray-800"
                      placeholder="0-100"
                      placeholderTextColor="#555"
                      keyboardType="numeric"
                      value={formProgress}
                      onChangeText={(text) => {
                        const num = parseInt(text, 10);
                        if (text === "" || (!isNaN(num) && num >= 0 && num <= 100)) {
                          setFormProgress(text);
                        }
                      }}
                    />

                    {/* Notes */}
                    <Text className="text-gray-400 text-xs mb-2 font-medium">备注</Text>
                    <TextInput
                      className="bg-gray-900 text-white rounded-xl px-4 py-3 mb-6 border border-gray-800"
                      placeholder="学习笔记或心得..."
                      placeholderTextColor="#555"
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      value={formNotes}
                      onChangeText={setFormNotes}
                    />

                    {/* Buttons */}
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        onPress={() => setModalVisible(false)}
                        className="flex-1 py-4 rounded-xl bg-gray-900 border border-gray-800 items-center"
                      >
                        <Text className="text-gray-400 font-medium">取消</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        className="flex-1 py-4 rounded-xl bg-cyan-500 items-center"
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color="#000" />
                        ) : (
                          <Text className="text-black font-bold">保存</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </Screen>
  );
}
