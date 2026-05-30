import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNovelStore } from '../store/useNovelStore';
import { getNovels as apiGetNovels, deleteNovel as apiDeleteNovel } from '../api/client';
import { getNovels as getLocalNovels, deleteNovelById } from '../db/sqlite';
import { GlassCard, Tag, PulseProgressBar, SkeletonCard } from '../components';
import { colors, spacing, radii, typography, layout } from '../theme';
import type { NavigationProp, RootStackParamList } from '../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const COVER_COLORS: Array<[string, string]> = [
  ['#2563EB', '#60A5FA'],
  ['#22C55E', '#55E6C1'],
  ['#EF4444', '#FAB1A0'],
  ['#F97316', '#FFEAA7'],
  ['#0984E3', '#93C5FD'],
  ['#E84393', '#FD79A8'],
  ['#00B894', '#55EFC4'],
  ['#2563EB', '#93C5FD'],
  ['#EF4444', '#F87171'],
  ['#2D3436', '#636E72'],
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: '等待处理', color: colors.warning },
  queued: { label: '排队中', color: '#F97316' },
  analyzing: { label: 'AI 分析中', color: colors.accent },
  analyzed: { label: '待生成剧本', color: colors.accent },
  generating: { label: '生成剧集中', color: colors.accent },
  completed: { label: '已完成', color: colors.success },
  failed: { label: '生成失败', color: colors.error },
  error: { label: '出错了', color: colors.error },
};

function getGradient(title: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < (title || '').length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return COVER_COLORS[Math.abs(hash) % COVER_COLORS.length];
}

function CoverGradient({ colors: [c1, c2], char }: { colors: [string, string]; char: string }) {
  return (
    <View style={[styles.cover, { backgroundColor: c1 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c2, opacity: 0.3 }]} />
      <Text style={styles.coverText}>{char || '?'}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status || '未知', color: '#999' };
  const isActive = status === 'analyzing' || status === 'generating' || status === 'queued';

  const getIcon = () => {
    switch (status) {
      case 'completed': return 'checkmark-circle';
      case 'error':
      case 'failed': return 'close-circle';
      default: return 'document-text';
    }
  };

  return (
    <View style={styles.statusBadge}>
      {isActive ? (
        <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
      ) : (
        <Ionicons name={getIcon()} size={14} color={cfg.color} />
      )}
      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function NovelProgress({ status, queuePos }: { status: string; queuePos?: number }) {
  if (status === 'completed' || status === 'failed' || status === 'error') return null;
  if (status === 'queued') {
    return (
      <View style={styles.progressSection}>
        <PulseProgressBar height={3} />
        <Text style={styles.progressText}>
          {queuePos ? `排队中（第 ${queuePos} 位）` : '排队等待中'}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.progressSection}>
      <PulseProgressBar height={3} />
      <Text style={styles.progressText}>
        {status === 'analyzing' ? 'AI 分析中' : status === 'generating' ? '剧本生成中' : '等待处理'}
      </Text>
    </View>
  );
}

export function BookshelfScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp & NativeStackNavigationProp<RootStackParamList>>();
  const { novels, setNovels, removeNovel, isLoggedIn, queueStatus } = useNovelStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNovels = useCallback(async () => {
    let serverOk = false;
    try {
      const serverRes = await apiGetNovels();
      const serverNovels = serverRes?.data?.data?.novels || [];
      setNovels(serverNovels);
      serverOk = true;
    } catch {}
    if (!serverOk) {
      const local = await getLocalNovels().catch(() => []);
      if (local.length > 0) setNovels(local);
    }
    setLoading(false);
  }, [setNovels]);

  const hasActiveNovels = novels.some(n => n.status === 'analyzing' || n.status === 'generating' || n.status === 'pending' || n.status === 'queued');

  useFocusEffect(useCallback(() => {
    fetchNovels();
    const interval = setInterval(fetchNovels, hasActiveNovels ? 10000 : 30000);
    return () => clearInterval(interval);
  }, [fetchNovels, hasActiveNovels]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNovels();
    setRefreshing(false);
  };

  const handleLongPress = (item: any) => {
    Alert.alert('删除剧本', `确定删除「${item.title}」吗？\n（将停止正在进行的分析/生成任务，并清除所有数据）`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          try {
            // 先调服务端 API（停止后台任务 + 级联删除数据 + 删除文件）
            await apiDeleteNovel(item.id);
          } catch {}
          // 清理本地 SQLite 和 store
          try {
            await deleteNovelById(item.id);
          } catch {}
          removeNovel(item.id);
        },
      },
    ]);
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const status = item.status || 'pending';
    const [c1, c2] = getGradient(item.title);
    const qInfo = queueStatus[item.id];
    const queuePos = qInfo?.position || 0;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          if (status === 'completed') {
            navigation.navigate('ScriptDetail', { novelId: item.id, novelTitle: item.title });
          } else {
            navigation.navigate('TaskProgress', { novelId: item.id, novelTitle: item.title });
          }
        }}
        onLongPress={() => handleLongPress(item)}
        style={styles.cardOuter}
      >
        <GlassCard padded={false} style={styles.card}>
          <CoverGradient colors={[c1, c2]} char={item.title?.[0] || '?'} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {item.genre ? <Tag text={item.genre} color={c1} style={{ marginBottom: spacing.sm }} /> : null}
            <NovelProgress status={status} queuePos={queuePos} />
            <StatusBadge status={status} />
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle}>我的书架</Text>
        <View style={styles.grid}>
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>我的书架</Text>
      {novels.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyText}>{isLoggedIn ? '书架还是空的' : '请先登录'}</Text>
          <Text style={styles.emptySub}>{isLoggedIn ? '上传一本小说开始创作' : '登录后可查看书架内容'}</Text>
          {!isLoggedIn && (
            <TouchableOpacity style={styles.loginGuideBtn} onPress={() => navigation.navigate('Home' as any)}>
              <Text style={styles.loginGuideText}>去登录</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={novels}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  pageTitle: { ...typography.h1, paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xxl },
  row: { justifyContent: 'space-between' },
  cardOuter: { width: layout.cardWidth, marginBottom: spacing.md, marginHorizontal: spacing.xs },
  card: { overflow: 'hidden' },
  cover: {
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  coverText: { fontSize: 36, fontWeight: '800', color: 'rgba(255,255,255,0.9)' },
  cardBody: { padding: spacing.sm + 2 },
  cardTitle: { ...typography.h3, marginBottom: spacing.xs },
  progressSection: { marginBottom: spacing.sm },
  progressText: { fontSize: 11, color: colors.text.tertiary, marginTop: 4, textAlign: 'right' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusIcon: { fontSize: 12, marginRight: 4 },
  statusText: { ...typography.caption, fontWeight: '600' },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm,
  },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 56, marginBottom: spacing.md },
  emptyText: { ...typography.h2, color: colors.text.tertiary, marginBottom: spacing.xs },
  emptySub: { ...typography.caption, color: colors.text.tertiary, marginBottom: spacing.md },
  loginGuideBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
  },
  loginGuideText: { ...typography.h3, color: colors.text.inverse },
});
