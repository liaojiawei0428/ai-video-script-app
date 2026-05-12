import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getEpisodes } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';

export function EpisodeListScreen(): React.JSX.Element {
  const route = useRoute();
  const navigation = useNavigation();
  const { novelId } = route.params as { novelId: string };
  const { episodes, setEpisodes } = useNovelStore();

  useEffect(() => {
    loadEpisodes();
  }, []);

  const loadEpisodes = async () => {
    try {
      const response = await getEpisodes(novelId);
      setEpisodes(response.data.data.episodes);
    } catch (error) {
      console.error('Failed to load episodes', error);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={episodes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.episodeCard}
            onPress={() =>
              navigation.navigate('ScriptDetail' as never, { episodeId: item.id } as never)
            }
          >
            <Text style={styles.episodeNumber}>第{item.episodeNumber}集</Text>
            <Text style={styles.episodeTitle}>{item.title}</Text>
            <Text style={styles.episodeInfo}>
              时长: {item.durationSec}秒 · 场景: {item.sceneLocation}
            </Text>
            <Text style={styles.summary} numberOfLines={2}>
              {item.summary}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  episodeCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  episodeNumber: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  episodeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  episodeInfo: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  summary: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
});
