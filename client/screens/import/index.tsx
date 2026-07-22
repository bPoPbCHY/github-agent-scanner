import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Keyboard,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

const POPULAR_REPOS = [
  { name: 'AutoGen', url: 'https://github.com/microsoft/autogen', desc: 'Multi-agent conversation framework' },
  { name: 'LangChain', url: 'https://github.com/langchain-ai/langchain', desc: 'Building apps with LLMs' },
  { name: 'CrewAI', url: 'https://github.com/crewAIInc/crewAI', desc: 'Framework for orchestrating role-playing AI agents' },
  { name: 'MetaGPT', url: 'https://github.com/geekan/MetaGPT', desc: 'Multi-agent metropolis for AI' },
  { name: 'OpenDevin', url: 'https://github.com/All-Hands-AI/OpenHands', desc: 'Open platform for AI software developers' },
];

export default function ImportScreen() {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();

  const handleImport = async () => {
    const url = repoUrl.trim();
    if (!url) {
      Alert.alert('Error', 'Please enter a GitHub repository URL');
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: url }),
      });

      const json = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          Alert.alert('Already Imported', 'This project has already been imported.');
        } else {
          Alert.alert('Import Failed', json.error || 'Unknown error');
        }
        setLoading(false);
        return;
      }

      // Navigate to project detail
      router.replace('/project-detail', { projectId: json.data.id });
    } catch (err) {
      Alert.alert('Error', 'Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleQuickImport = (url: string) => {
    setRepoUrl(url);
  };

  return (
    <Screen
      backgroundColor="#0A0A0F"
      statusBarStyle="light"
      safeAreaEdges={['left', 'right', 'bottom']}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome6 name="arrow-left" size={18} color="#00F0FF" />
        </Pressable>
        <View>
          <Text style={styles.headerLabel}>NEW SCAN</Text>
          <Text style={styles.headerTitle}>Import Repository</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inputSection}>
          <Text style={styles.sectionLabel}>GITHUB REPOSITORY URL</Text>
          <View style={styles.inputContainer}>
            <FontAwesome6 name="github" size={18} color="#555570" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="https://github.com/owner/repo"
              placeholderTextColor="#555570"
              value={repoUrl}
              onChangeText={setRepoUrl}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <Pressable
            onPress={handleImport}
            disabled={loading}
            style={[styles.importButton, loading && styles.importButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#0A0A0F" />
            ) : (
              <>
                <FontAwesome6 name="download" size={14} color="#0A0A0F" />
                <Text style={styles.importButtonText}>START SCANNING</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.divider} />

        <View style={styles.quickSection}>
          <Text style={styles.sectionLabel}>POPULAR AI AGENT PROJECTS</Text>
          {POPULAR_REPOS.map((repo) => (
            <Pressable
              key={repo.url}
              onPress={() => handleQuickImport(repo.url)}
              style={styles.quickCard}
            >
              <View style={styles.quickCardLeft}>
                <Text style={styles.quickCardName}>{repo.name}</Text>
                <Text style={styles.quickCardDesc} numberOfLines={1}>{repo.desc}</Text>
              </View>
              <FontAwesome6 name="chevron-right" size={12} color="#555570" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#12121A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,240,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    fontSize: 11,
    letterSpacing: 3,
    color: '#555570',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EAEAEA',
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  inputSection: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: '#555570',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12121A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.15)',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#EAEAEA',
    fontSize: 14,
    paddingVertical: 14,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as Record<string, unknown> : {}),
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00F0FF',
    borderRadius: 6,
    paddingVertical: 14,
    marginTop: 4,
  },
  importButtonDisabled: {
    opacity: 0.5,
  },
  importButtonText: {
    color: '#0A0A0F',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,240,255,0.06)',
    marginVertical: 24,
  },
  quickSection: {
    gap: 12,
  },
  quickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12121A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.08)',
    padding: 14,
  },
  quickCardLeft: {
    flex: 1,
  },
  quickCardName: {
    color: '#EAEAEA',
    fontSize: 14,
    fontWeight: '600',
  },
  quickCardDesc: {
    color: '#555570',
    fontSize: 12,
    marginTop: 2,
  },
});
