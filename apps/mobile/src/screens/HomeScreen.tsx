import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNovelStore } from '../store/useNovelStore';
import { getNovels, initDatabase } from '../db/sqlite';

export function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { novels, setNovels } = useNovelStore();

  useEffect(() => {
    loadNovels();
  }, []);

  const loadNovels = async () => {
    await initDatabase();
    const localNovels = await getNovels();
    setNovels(localNovels);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.uploadButton}
        onPress={() => navigation.navigate('Upload' as never)}
      >
        <Text style={styles.uploadButtonText}>+ 上传小说</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>我的项目</Text>

      <FlatList
        data={novels}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.novelCard}
            onPress={() => navigation.navigate('Analysis' as never, { novelId: item.id } as never)}
          >
            <Text style={styles.novelTitle}>{item.title}</Text>
            <Text style={styles.novelInfo}>
              {item.author} · {item.total_chars}字 · {item.status}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>暂无项目，点击上方按钮上传小说</Text>
        }
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
  uploadButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  novelCard: {
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
  novelTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  novelInfo: {
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
});
