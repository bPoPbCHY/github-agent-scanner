import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import SSE from 'react-native-sse';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

interface ProjectData {
  id: number;
  name: string;
  repo_url: string;
  owner: string;
  repo_name: string;
  description: string | null;
  stars: number;
  language: string | null;
  readme_content: string | null;
  file_structure: string | null;
  analysis_result: string | null;
  analysis_status: string;
  topics: string[] | null;
  created_at: string;
}

interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

type TabType = 'overview' | 'analysis' | 'chat';

export default function ProjectDetailScreen() {
  const { projectId } = useSafeSearchParams<{ projectId: number }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStream, setAnalysisStream] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const chatEndRef = useRef<View>(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}`);
      const json = await response.json();
      setProject(json.data);
      if (json.data?.analysis_status === 'analyzing') {
        setAnalyzing(true);
      }
    } catch (err) {
      console.error('Failed to fetch project:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchConversations = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/conversations`);
      const json = await response.json();
      setMessages(json.data || []);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      fetchProject();
      fetchConversations();
    }, [fetchProject, fetchConversations])
  );

  useEffect(() => {
    if (chatEndRef.current && activeTab === 'chat') {
      (chatEndRef.current as any).setPageScrollY?.(99999);
    }
  }, [messages.length, streamingText, activeTab]);

  const handleAnalyze = () => {
    if (!projectId || analyzing) return;
    setAnalyzing(true);
    setAnalysisStream('');
    setActiveTab('analysis');

    const sse = new SSE(`${API_BASE}/api/v1/projects/${projectId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    sse.addEventListener('message', (event) => {
      if (event.data === '[DONE]') {
        sse.close();
        setAnalyzing(false);
        fetchProject();
        return;
      }
      try {
        const parsed = JSON.parse(event.data || '{}');
        if (parsed.content) {
          setAnalysisStream((prev) => prev + parsed.content);
        }
        if (parsed.error) {
          Alert.alert('Error', parsed.error);
          setAnalyzing(false);
        }
      } catch {
        // ignore parse errors
      }
    });

    sse.addEventListener('error', () => {
      setAnalyzing(false);
      sse.close();
    });
  };

  const handleSendMessage = () => {
    const text = chatInput.trim();
    if (!text || chatLoading || !projectId) return;

    setChatInput('');
    setChatLoading(true);
    setStreamingText('');
    Keyboard.dismiss();

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);

    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const sse = new SSE(`${API_BASE}/api/v1/projects/${projectId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history }),
    });

    let fullResponse = '';

    sse.addEventListener('message', (event) => {
      if (event.data === '[DONE]') {
        sse.close();
        setChatLoading(false);
        if (fullResponse) {
          setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
        }
        setStreamingText('');
        return;
      }
      try {
        const parsed = JSON.parse(event.data || '{}');
        if (parsed.content) {
          fullResponse += parsed.content;
          setStreamingText(fullResponse);
        }
        if (parsed.error) {
          Alert.alert('Error', parsed.error);
          setChatLoading(false);
          setStreamingText('');
        }
      } catch {
        // ignore parse errors
      }
    });

    sse.addEventListener('error', () => {
      setChatLoading(false);
      setStreamingText('');
      sse.close();
    });
  };

  const handleDelete = () => {
    if (!projectId) return;
    Alert.alert('Delete Project', 'Are you sure you want to delete this project?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${API_BASE}/api/v1/projects/${projectId}`, { method: 'DELETE' });
            router.back();
          } catch {
            Alert.alert('Error', 'Failed to delete project');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen backgroundColor="#0A0A0F" statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00F0FF" />
          <Text style={styles.loadingText}>LOADING PROJECT DATA...</Text>
        </View>
      </Screen>
    );
  }

  if (!project) {
    return (
      <Screen backgroundColor="#0A0A0F" statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Project not found</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>GO BACK</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'analysis', label: 'ANALYSIS' },
    { key: 'chat', label: 'CHAT' },
  ];

  return (
    <Screen
      backgroundColor="#0A0A0F"
      statusBarStyle="light"
      safeAreaEdges={['left', 'right', 'bottom']}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome6 name="arrow-left" size={16} color="#00F0FF" />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{project.name}</Text>
            <Text style={styles.headerPath}>{project.owner}/{project.repo_name}</Text>
          </View>
          <Pressable onPress={handleDelete} style={styles.deleteButton}>
            <FontAwesome6 name="trash" size={14} color="#FF003C" />
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Content */}
      {activeTab === 'overview' && (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>STARS</Text>
              <Text style={styles.statValue}>{project.stars.toLocaleString()}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>LANGUAGE</Text>
              <Text style={styles.statValue}>{project.language || 'N/A'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>STATUS</Text>
              <Text style={[styles.statValue, {
                color: project.analysis_status === 'completed' ? '#00FF88' :
                  project.analysis_status === 'analyzing' ? '#BF00FF' : '#555570'
              }]}>
                {project.analysis_status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Description */}
          {project.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DESCRIPTION</Text>
              <Text style={styles.descriptionText}>{project.description}</Text>
            </View>
          ) : null}

          {/* Topics */}
          {project.topics && Array.isArray(project.topics) && project.topics.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TOPICS</Text>
              <View style={styles.topicsRow}>
                {project.topics.map((topic: string) => (
                  <View key={topic} style={styles.topicBadge}>
                    <Text style={styles.topicText}>{topic}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Analyze Button */}
          <Pressable
            onPress={handleAnalyze}
            disabled={analyzing}
            style={[styles.analyzeButton, analyzing && styles.analyzeButtonDisabled]}
          >
            {analyzing ? (
              <ActivityIndicator color="#0A0A0F" />
            ) : (
              <>
                <FontAwesome6 name="microscope" size={16} color="#0A0A0F" />
                <Text style={styles.analyzeButtonText}>
                  {project.analysis_status === 'completed' ? 'RE-ANALYZE PROJECT' : 'ANALYZE PROJECT'}
                </Text>
              </>
            )}
          </Pressable>

          {/* File Structure Preview */}
          {project.file_structure ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>FILE STRUCTURE</Text>
              <View style={styles.codeBlock}>
                <Text style={styles.codeText} numberOfLines={30}>
                  {project.file_structure.substring(0, 2000)}
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {activeTab === 'analysis' && (
        <ScrollView contentContainerStyle={styles.content}>
          {!project.analysis_result && !analysisStream ? (
            <View style={styles.emptyAnalysis}>
              <FontAwesome6 name="microscope" size={40} color="#555570" />
              <Text style={styles.emptyTitle}>No Analysis Yet</Text>
              <Text style={styles.emptySubtitle}>
                Run AI analysis to understand this project&apos;s architecture, capabilities, and key components.
              </Text>
              <Pressable onPress={handleAnalyze} disabled={analyzing} style={styles.analyzeButton}>
                {analyzing ? (
                  <ActivityIndicator color="#0A0A0F" />
                ) : (
                  <Text style={styles.analyzeButtonText}>START ANALYSIS</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.analysisContent}>
              <View style={styles.analysisHeader}>
                <Text style={styles.analysisLabel}>AI ANALYSIS REPORT</Text>
                {analyzing && (
                  <View style={styles.analyzingBadge}>
                    <ActivityIndicator size="small" color="#BF00FF" />
                    <Text style={styles.analyzingText}>SCANNING</Text>
                  </View>
                )}
              </View>
              <Text style={styles.analysisText}>
                {analysisStream || project.analysis_result || ''}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'chat' && (
        <View style={styles.chatContainer}>
          <FlatList
            data={messages}
            keyExtractor={(item, index) => String(item.id || index)}
            renderItem={({ item }) => (
              <View style={[
                styles.messageBubble,
                item.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}>
                <Text style={styles.messageRole}>
                  {item.role === 'user' ? 'YOU' : 'AGENT'}
                </Text>
                <Text style={styles.messageContent}>{item.content}</Text>
              </View>
            )}
            ListFooterComponent={
              streamingText ? (
                <View style={[styles.messageBubble, styles.assistantBubble]}>
                  <Text style={styles.messageRole}>AGENT</Text>
                  <Text style={styles.messageContent}>{streamingText}</Text>
                </View>
              ) : null
            }
            contentContainerStyle={styles.chatList}
            onLayout={() => chatEndRef.current && (chatEndRef.current as any).setPageScrollY?.(99999)}
          />
          <View ref={chatEndRef as any} style={{ height: 1 }} />

          <View style={styles.chatInputContainer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Ask about this project..."
              placeholderTextColor="#555570"
              value={chatInput}
              onChangeText={setChatInput}
              multiline
              maxLength={1000}
              editable={!chatLoading}
            />
            <Pressable
              onPress={handleSendMessage}
              disabled={chatLoading || !chatInput.trim()}
              style={[styles.sendButton, (!chatInput.trim() || chatLoading) && styles.sendButtonDisabled]}
            >
              <FontAwesome6 name="paper-plane" size={16} color={chatInput.trim() ? '#00F0FF' : '#555570'} />
            </Pressable>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0F',
    gap: 16,
  },
  loadingText: {
    color: '#555570',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF003C',
    fontSize: 16,
    fontWeight: '600',
  },
  backBtn: {
    borderWidth: 1,
    borderColor: '#00F0FF',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  backBtnText: {
    color: '#00F0FF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#12121A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,240,255,0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    color: '#EAEAEA',
    fontSize: 18,
    fontWeight: '700',
  },
  headerPath: {
    color: '#555570',
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,0,60,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'rgba(0,240,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.2)',
  },
  tabText: {
    color: '#555570',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  tabTextActive: {
    color: '#00F0FF',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#12121A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.1)',
    padding: 14,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#555570',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00F0FF',
    marginTop: 6,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    color: '#555570',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  descriptionText: {
    color: '#EAEAEA',
    fontSize: 14,
    lineHeight: 22,
  },
  topicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  topicBadge: {
    backgroundColor: 'rgba(0,240,255,0.08)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.15)',
  },
  topicText: {
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: '500',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00F0FF',
    borderRadius: 6,
    paddingVertical: 14,
    marginVertical: 8,
  },
  analyzeButtonDisabled: {
    opacity: 0.5,
  },
  analyzeButtonText: {
    color: '#0A0A0F',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  codeBlock: {
    backgroundColor: '#0A0A0F',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.08)',
    padding: 12,
  },
  codeText: {
    color: '#555570',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyAnalysis: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    color: '#EAEAEA',
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#555570',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  analysisContent: {
    gap: 12,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  analysisLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: '#00F0FF',
    fontWeight: '600',
  },
  analyzingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(191,0,255,0.1)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(191,0,255,0.3)',
  },
  analyzingText: {
    color: '#BF00FF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  analysisText: {
    color: '#EAEAEA',
    fontSize: 14,
    lineHeight: 24,
  },
  chatContainer: {
    flex: 1,
  },
  chatList: {
    padding: 16,
    paddingBottom: 80,
  },
  messageBubble: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: 'rgba(0,240,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.2)',
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.08)',
    alignSelf: 'flex-start',
  },
  messageRole: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#555570',
    fontWeight: '700',
    marginBottom: 4,
  },
  messageContent: {
    color: '#EAEAEA',
    fontSize: 14,
    lineHeight: 22,
  },
  chatInputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    paddingBottom: 16,
    backgroundColor: '#0A0A0F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,240,255,0.1)',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#12121A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#EAEAEA',
    fontSize: 14,
    maxHeight: 100,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as Record<string, unknown> : {}),
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12121A',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
