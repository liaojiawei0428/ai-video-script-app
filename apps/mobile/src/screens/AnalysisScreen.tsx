import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getNovelAnalysis } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';

export function AnalysisScreen(): React.JSX.Element {
  const route = useRoute();
  const navigation = useNavigation();
  const { novelId } = route.params as { novelId: string };
  const { characters, setCharacters } = useNovelStore();

  useEffect(() => {
    loadAnalysis();
  }, []);

  const loadAnalysis = async () => {
    try {
      const response = await getNovelAnalysis(novelId);
      if (response.data.data.characters) {
        setCharacters(response.data.data.characters);
      }
    } catch (error) {
      console.error('Failed to load analysis', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>角色设定</Text>
      {characters.map((char) => (
        <View key={char.id} style={styles.card}>
          <Text style={styles.characterName}>{char.name}</Text>
          <Text style={styles.characterInfo}>身份: {char.roleType}</Text>
          <Text style={styles.characterInfo}>外貌: {char.appearance}</Text>
          <Text style={styles.characterInfo}>性格: {char.personality}</Text>
        </View>
      ))}

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() =>
          navigation.navigate('Progress' as never, {
            novelId,
            taskType: 'episode_generate',
          } as never)
        }
      >
        <Text style={styles.actionButtonText}>生成剧集剧本</Text>
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  card: {
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
  characterName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  characterInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
