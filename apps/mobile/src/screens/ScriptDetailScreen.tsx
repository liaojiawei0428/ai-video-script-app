import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useNovelStore } from '../store/useNovelStore';

export function ScriptDetailScreen(): React.JSX.Element {
  const route = useRoute();
  const { episodeId } = route.params as { episodeId: string };
  const { episodes } = useNovelStore();
  const [episode, setEpisode] = useState(episodes.find((e) => e.id === episodeId));

  useEffect(() => {
    setEpisode(episodes.find((e) => e.id === episodeId));
  }, [episodes, episodeId]);

  const handleShare = async () => {
    if (!episode) return;
    try {
      await Share.share({
        message: episode.scriptContent,
        title: episode.title,
      });
    } catch (error) {
      console.error('Share failed', error);
    }
  };

  if (!episode) {
    return (
      <View style={styles.container}>
        <Text>剧集不存在</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{episode.title}</Text>
      <Text style={styles.meta}>
        第{episode.episodeNumber}集 · {episode.durationSec}秒 · {episode.sceneLocation}
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>剧情摘要</Text>
        <Text style={styles.content}>{episode.summary}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>剧本内容</Text>
        <Text style={styles.scriptContent}>{episode.scriptContent}</Text>
      </View>

      <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
        <Text style={styles.shareButtonText}>分享剧本</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  meta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#007AFF',
  },
  content: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
  },
  scriptContent: {
    fontSize: 14,
    lineHeight: 24,
    color: '#333',
    fontFamily: 'monospace',
  },
  shareButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
