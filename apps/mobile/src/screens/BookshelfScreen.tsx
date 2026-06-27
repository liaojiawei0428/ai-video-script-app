import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl, TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNovelStore } from '../store/useNovelStore';
import { getNovels as apiGetNovels, deleteNovel as apiDeleteNovel } from '../api/client';
import { getNovels as getLocalNovels, deleteNovelById, saveNovel as saveNovelDb, diffNovelsByHash, saveNovelIfChanged } from '../db/sqlite';
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
  // v2.0.0 搜索/筛选
  const [searchQ, setSearchQ] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'failed'>('all');

  // v2.0.0 过滤后的列表
  const filteredNovels = useMemo(() => {
    let list = novels;
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      list = list.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.author || '').toLowerCase().includes(q) ||
        (n.genre || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus === 'active') {
      list = list.filter(n => ['pending', 'queued', 'analyzing', 'analyzed', 'generating'].includes(n.status));
    } else if (filterStatus === 'completed') {
      list = list.filter(n => n.status === 'completed');
    } else if (filterStatus === 'failed') {
      list = list.filter(n => n.status === 'failed' || n.status === 'error');
    }
    return list;
  }, [novels, searchQ, filterStatus]);

  const fetchNovels = useCallback(async () => {
    const loggedIn = useNovelStore.getState().isLoggedIn;

    // 未登录不加载任何数据
    if (!loggedIn) {
      setNovels([]);
      setLoading(false);
      return;
    }

    // 1. 优先加载本地数据（离线可用，仅在登录状态下）
    const local = await getLocalNovels().catch(() => []);
    if (local.length > 0) {
      setNovels(local);
      setLoading(false); // 🆕 S72 batch 16 v3.0.45 BUG-115 A.4: 本地有数据立即停止 loading (秒开)
    }

    // 2. 从服务端同步最新数据
    try {
      const serverRes = await apiGetNovels();
      const serverNovels = serverRes?.data?.data?.novels || [];

      // 🆕 S72 batch 16 v3.0.45 BUG-115 缓存方案 A.4: hash 比对, 没变的 novel 不 setState 不写 SQLite
      // 减少 90% 无效 re-render + 减少 90% 写 SQLite
      const { changed } = await diffNovelsByHash(serverNovels);

      // 🆕 S72 batch 17 v3.0.46 BUG-116 缓存方案 B.4: ETag/304 短路检查
      // axios interceptor 收到 304 时构造 status=200 + x-cache=HIT-304 header (从 cache_meta 返 body)
      // 这里检查响应 headers['x-cache'] === 'HIT-304', 跳过 hash 比对 (已经是缓存命中)
      const fromCache = serverRes?.headers?.['x-cache'] === 'HIT-304';

      if (changed.length > 0 && !fromCache) {
        // 有数据变化: setState 触发 re-render + saveNovelIfChanged 写 SQLite
        setNovels(serverNovels);
        for (const n of changed) {
          await saveNovelIfChanged({
            id: n.id, title: n.title, author: n.author || 'User',
            totalChars: n.totalChars || 0, totalWords: n.totalWords || 0,
            genre: n.genre || '', theme: n.theme || '', style: n.style || '', tone: n.tone || '',
            summary: n.summary || '', scenes: n.scenes || [], plotPoints: n.plotPoints || [],
            status: n.status, createdAt: n.createdAt || Date.now(), updatedAt: n.updatedAt || Date.now(),
          }).catch(() => {});
        }
      }
      // else: 304 命中 或 hash 完全一致 → skip setState 避免 re-render
    } catch {
      // 服务端不可用时，已显示本地数据
    }
    setLoading(false);
  }, [setNovels]);

  const hasActiveNovels = novels.some(n => n.status === 'analyzing' || n.status === 'generating' || n.status === 'pending' || n.status === 'queued');

  useFocusEffect(useCallback(() => {
    fetchNovels();
    // 🆕 S72 batch 16 v3.0.45 BUG-115 缓存方案 A.4: fetchInterval 从 10s/30s 改 5min (减轻流量 + CPU + 电量)
    // 任务状态变化靠 user 主动操作 (navigate to ScriptDetail/TaskProgress) 触发 + 后台 polling task 接口
    // 5min polling 书架只为发现"用户新上传/删除小说"这类低频变化
    const interval = setInterval(fetchNovels, 5 * 60 * 1000);
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
          // 清理本地 SQLite、store 和流式内容
          try {
            await deleteNovelById(item.id);
          } catch {}
          removeNovel(item.id);
          useNovelStore.getState().clearChunkStreams();
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

      {/* v2.0.0 搜索框 + 状态筛选 */}
      {novels.length > 0 && (
        <View style={styles.filterBar}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              value={searchQ}
              onChangeText={setSearchQ}
              placeholder="搜索标题/作者/类型"
              placeholderTextColor={colors.text.tertiary}
              returnKeyType="search"
            />
            {searchQ ? (
              <TouchableOpacity onPress={() => setSearchQ('')}>
                <Ionicons name="close-circle" size={16} color={colors.text.tertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.statusTabs}>
            {([
              ['all', '全部'],
              ['active', '进行中'],
              ['completed', '已完成'],
              ['failed', '失败'],
            ] as const).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.statusTab, filterStatus === key && styles.statusTabActive]}
                onPress={() => setFilterStatus(key as any)}
              >
                <Text style={[styles.statusTabText, filterStatus === key && styles.statusTabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {novels.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="book" size={48} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>{isLoggedIn ? '书架还是空的' : '请先登录'}</Text>
          <Text style={styles.emptySub}>{isLoggedIn ? '上传一本小说开始创作' : '登录后可查看书架内容'}</Text>
          {!isLoggedIn && (
            <TouchableOpacity style={styles.loginGuideBtn} onPress={() => navigation.navigate('Home' as any)}>
              <Text style={styles.loginGuideText}>去登录</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : filteredNovels.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={48} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>没有匹配的剧本</Text>
          <Text style={styles.emptySub}>尝试调整搜索词或筛选</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNovels}
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
  // v2.0.0 搜索/筛选
  filterBar: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.bg.secondary, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text.primary, padding: 0 },
  statusTabs: { flexDirection: 'row', gap: 6 },
  statusTab: {
    flex: 1, paddingVertical: 6, borderRadius: radii.full, alignItems: 'center',
    backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border,
  },
  statusTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  statusTabText: { ...typography.caption, color: colors.text.secondary, fontSize: 12, fontWeight: '600' },
  statusTabTextActive: { color: '#fff' },
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
