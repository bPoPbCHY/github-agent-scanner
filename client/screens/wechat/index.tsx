import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

interface WeChatConfig {
  webhook_url: string;
  token: string;
  instructions: Record<string, string>;
}

export default function WeChatScreen() {
  const [config, setConfig] = useState<WeChatConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/wechat/config`);
      const json = await response.json();
      setConfig(json.data);
    } catch (err) {
      console.error('Failed to fetch WeChat config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchConfig();
    }, [fetchConfig])
  );

  const handleCopy = async (text: string, label: string) => {
    try {
      if (Platform.OS === 'web') {
        await (window as any).navigator?.clipboard?.writeText(text);
      } else {
        // On mobile, use Alert to show the text for manual copy
        Alert.alert(label, text);
        return;
      }
      Alert.alert('Copied', `${label} copied to clipboard`);
    } catch {
      Alert.alert(label, text);
    }
  };

  if (loading) {
    return (
      <Screen backgroundColor="#0A0A0F" statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00F0FF" />
          <Text style={styles.loadingText}>LOADING CONFIG...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      backgroundColor="#0A0A0F"
      statusBarStyle="light"
      safeAreaEdges={['left', 'right', 'bottom']}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome6 name="arrow-left" size={16} color="#00F0FF" />
        </Pressable>
        <View>
          <Text style={styles.headerLabel}>INTEGRATION</Text>
          <Text style={styles.headerTitle}>WeChat Setup</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Webhook URL */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WEBHOOK URL</Text>
          <View style={styles.copyCard}>
            <Text style={styles.copyText} selectable>
              {config?.webhook_url || 'N/A'}
            </Text>
            <Pressable
              onPress={() => handleCopy(config?.webhook_url || '', 'Webhook URL')}
              style={styles.copyButton}
            >
              <FontAwesome6 name="copy" size={14} color="#00F0FF" />
            </Pressable>
          </View>
        </View>

        {/* Token */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>VERIFICATION TOKEN</Text>
          <View style={styles.copyCard}>
            <Text style={styles.copyText} selectable>
              {config?.token || 'N/A'}
            </Text>
            <Pressable
              onPress={() => handleCopy(config?.token || '', 'Token')}
              style={styles.copyButton}
            >
              <FontAwesome6 name="copy" size={14} color="#00F0FF" />
            </Pressable>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SETUP INSTRUCTIONS</Text>
          {config?.instructions && Object.entries(config.instructions).map(([key, value]) => (
            <View key={key} style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{key.replace('step', '')}</Text>
              </View>
              <Text style={styles.stepText}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Commands */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AVAILABLE COMMANDS</Text>
          <View style={styles.commandCard}>
            <View style={styles.commandRow}>
              <Text style={styles.commandName}>list / help</Text>
              <Text style={styles.commandDesc}>List all imported projects</Text>
            </View>
            <View style={styles.commandDivider} />
            <View style={styles.commandRow}>
              <Text style={styles.commandName}>import &lt;url&gt;</Text>
              <Text style={styles.commandDesc}>Import a GitHub repository</Text>
            </View>
            <View style={styles.commandDivider} />
            <View style={styles.commandRow}>
              <Text style={styles.commandName}>ask &lt;name&gt; &lt;q&gt;</Text>
              <Text style={styles.commandDesc}>Ask about a specific project</Text>
            </View>
          </View>
        </View>

        {/* Warning */}
        <View style={styles.warningCard}>
          <FontAwesome6 name="triangle-exclamation" size={16} color="#FF003C" />
          <Text style={styles.warningText}>
            WeChat integration requires a verified WeChat Official Account.
            The webhook URL must be publicly accessible.
          </Text>
        </View>
      </ScrollView>
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
    width: 36,
    height: 36,
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
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: '#555570',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  copyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12121A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.15)',
    padding: 12,
    gap: 10,
  },
  copyText: {
    flex: 1,
    color: '#00F0FF',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  copyButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(0,240,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: 'rgba(0,240,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    color: '#EAEAEA',
    fontSize: 13,
    lineHeight: 20,
  },
  commandCard: {
    backgroundColor: '#12121A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.08)',
    padding: 14,
  },
  commandRow: {
    paddingVertical: 8,
  },
  commandName: {
    color: '#00F0FF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  commandDesc: {
    color: '#555570',
    fontSize: 12,
    marginTop: 2,
  },
  commandDivider: {
    height: 1,
    backgroundColor: 'rgba(0,240,255,0.06)',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,0,60,0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,0,60,0.15)',
    padding: 14,
  },
  warningText: {
    flex: 1,
    color: '#FF003C',
    fontSize: 12,
    lineHeight: 18,
  },
});
