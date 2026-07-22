import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

interface Project {
  id: number;
  name: string;
  repo_url: string;
  owner: string;
  repo_name: string;
  description: string | null;
  stars: number;
  language: string | null;
  analysis_status: string;
  topics: string[] | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'PENDING', color: '#555570' },
  analyzing: { label: 'SCANNING', color: '#BF00FF' },
  completed: { label: 'ANALYZED', color: '#00FF88' },
  failed: { label: 'FAILED', color: '#FF003C' },
};

function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
  const statusCfg = STATUS_CONFIG[project.analysis_status] || STATUS_CONFIG.pending;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {project.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
          <Text style={styles.repoPath} numberOfLines={1}>
            {project.owner}/{project.repo_name}
          </Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: statusCfg.color }]}>
          <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
          <Text style={[styles.statusText, { color: statusCfg.color }]}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      {project.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {project.description}
        </Text>
      ) : null}

      <View style={styles.cardFooter}>
        <View style={styles.metaItem}>
          <FontAwesome6 name="star" size={12} color="#00F0FF" />
          <Text style={styles.metaText}>{project.stars.toLocaleString()}</Text>
        </View>
        {project.language ? (
          <View style={styles.metaItem}>
            <FontAwesome6 name="code" size={12} color="#555570" />
            <Text style={styles.metaText}>{project.language}</Text>
          </View>
        ) : null}
        <View style={styles.metaItem}>
          <FontAwesome6 name="github" size={12} color="#555570" />
          <Text style={styles.metaText} numberOfLines={1}>{project.repo_url}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects`);
      const json = await response.json();
      setProjects(json.data || []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProjects();
    }, [fetchProjects])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProjects();
  };

  return (
    <Screen
      backgroundColor="#0A0A0F"
      statusBarStyle="light"
      safeAreaEdges={['left', 'right', 'bottom']}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerLabel}>AGENT SCANNER</Text>
            <Text style={styles.headerTitle}>GitHub Projects</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/wechat')}
              style={styles.iconButton}
            >
              <FontAwesome6 name="comment-dots" size={20} color="#00F0FF" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/import')}
              style={styles.addButton}
            >
              <FontAwesome6 name="plus" size={14} color="#0A0A0F" />
              <Text style={styles.addButtonText}>IMPORT</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.headerDivider} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00F0FF" />
          <Text style={styles.loadingText}>INITIALIZING SCANNER...</Text>
        </View>
      ) : projects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome6 name="robot" size={48} color="#555570" />
          <Text style={styles.emptyTitle}>No Projects Scanned</Text>
          <Text style={styles.emptySubtitle}>
            Import a GitHub AI Agent repository to begin analysis
          </Text>
          <Pressable
            onPress={() => router.push('/import')}
            style={styles.emptyButton}
          >
            <Text style={styles.emptyButtonText}>IMPORT FIRST PROJECT</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onPress={() => router.push('/project-detail', { projectId: item.id })}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00F0FF"
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#12121A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,240,255,0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLabel: {
    fontSize: 11,
    letterSpacing: 3,
    color: '#555570',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#EAEAEA',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12121A',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00F0FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#0A0A0F',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerDivider: {
    height: 2,
    width: 60,
    marginTop: 12,
    borderRadius: 1,
    backgroundColor: '#00F0FF',
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#555570',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    color: '#EAEAEA',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: '#555570',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#00F0FF',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyButtonText: {
    color: '#00F0FF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#12121A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.12)',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0,240,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#00F0FF',
    fontSize: 18,
    fontWeight: '700',
  },
  cardInfo: {
    flex: 1,
  },
  projectName: {
    color: '#EAEAEA',
    fontSize: 16,
    fontWeight: '700',
  },
  repoPath: {
    color: '#555570',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  description: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,240,255,0.06)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#555570',
    fontSize: 11,
  },
});
