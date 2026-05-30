import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl, Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useNovelStore } from '../store/useNovelStore';
import { getNovels, initDatabase, deleteNovelById } from '../db/sqlite';
import type { NavigationProp } from '../types/navigation';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;
const COVER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

function getColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < (title || '').length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return COVER_COLORS[Math.abs(hash) % COVER_COLORS.length];
}

const STATUS_LABELS: Record<string, string> = {
  pending: '等待中', analyzing: '分析中', analyzed: '已完成',
  generating: '生成中', completed: '已完成', error: '出错了',
};

export function ScriptListScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { novels, setNovels, removeNovel } = useNovelStore();

  useFocusEffect(useCallback(() => {
    (async () => {
      await initDatabase();
      const local = await getNovels();
      setNovels(local);
    })();
  }, []));

  const handleLongPress = (item: any) => {
    Alert.alert('删除剧本', `确定删除「${item.title}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          await deleteNovelById(item.id);
          removeNovel(item.id);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('EpisodeList', { novelId: item.id, novelTitle: item.title })}
      onLongPress={() => handleLongPress(item)}
    >
      <View style={[styles.cover, { backgroundColor: getColor(item.title) }]}>
        <Text style={styles.coverText}>{item.title?.[0] || '?'}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardMeta}>
          {item.genre || '未分类'} · {Math.floor((item.total_chars || 0) / 10000)}万字
        </Text>
        <View style={styles.cardFooter}>
          <View style={[styles.statusDot, {
            backgroundColor: item.status === 'completed' || item.status === 'analyzed' ? '#22C55E' : '#FF9500'
          }]} />
          <Text style={styles.cardStatus}>
            {STATUS_LABELS[item.status] || item.status}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const completedNovels = novels.filter(n => n.status === 'completed' || n.status === 'analyzed');

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>📖 我的剧本</Text>
      {completedNovels.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="book" size={48} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>书架是空的</Text>
          <Text style={styles.emptySub}>前往「创建」页上传小说开始生成剧本</Text>
        </View>
      ) : (
        <FlatList
          data={completedNovels}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#1C1C1E', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  list: { padding: 12, paddingBottom: 32 },
  row: { justifyContent: 'space-between' },
  card: {
    width: CARD_WIDTH, backgroundColor: '#fff', borderRadius: 14, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    overflow: 'hidden',
  },
  cover: { height: 100, justifyContent: 'center', alignItems: 'center' },
  coverText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  cardBody: { padding: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  cardMeta: { fontSize: 12, color: '#94A3B8', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  cardStatus: { fontSize: 11, color: '#94A3B8' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#94A3B8', marginBottom: 4 },
  emptySub: { fontSize: 14, color: '#C7C7CC' },
});
