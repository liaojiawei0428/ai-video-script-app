import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getEpisodes, getEpisode, getNovelAnalysis } from '../api/client';
import { saveEpisodes, getEpisodes as getLocalEpisodes } from '../db/sqlite';
import { GlassCard, Tag, SkeletonLoader } from '../components';
import { colors, spacing, radii, typography } from '../theme';
import type { NavigationProp, ScriptDetailRouteProp } from '../types/navigation';

export function ScriptDetailScreen(): React.JSX.Element {
  const route = useRoute<ScriptDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { novelId, novelTitle } = route.params;
  const [loading, setLoading] = useState(true);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loadingEpId, setLoadingEpId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string>('');

  useEffect(() => {
    if (!novelId) return;
    navigation.setOptions({ title: novelTitle || '剧本详情' });

    let cancelled = false;
      // 先尝试本地 SQLite 缓存
      (async () => {
        try {
          const local = await getLocalEpisodes(novelId);
          if (local && local.length > 0 && !cancelled) {
            setEpisodes(local);
          }
        } catch {}
      })();

    // 服务端请求（分别 await，避免 Promise.all 一个挂起全挂）
    (async () => {
      try {
        const epsRes = await getEpisodes(novelId);
        if (cancelled) return;
        const eps = epsRes.data.data.episodes || [];
        setEpisodes(eps);
        setAnalysis((await getNovelAnalysis(novelId).catch(() => ({ data: { data: {} } }))).data?.data || {});
        await saveEpisodes(eps).catch(() => {});
        if (eps.length === 0) setLoadError('该小说暂无剧集数据');
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.response?.status === 401 ? '登录已过期' : '加载失败，下拉刷新重试');
      }
      if (!cancelled) setLoading(false);
    })();

    // 15 秒超时
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setLoadError('加载超时，请下拉刷新重试');
      }
    }, 15000);

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [novelId, novelTitle]);

  const handleEpisodePress = async (ep: any) => {
    setLoadingEpId(ep.id);
    try {
      const res = await getEpisode(ep.id);
      const fullEp = res.data.data?.episode;
      if (fullEp) {
        navigation.navigate('EpisodeDetail', {
          novelId,
          episodeId: ep.id,
          episodeTitle: `第${ep.episodeNumber}集 ${ep.title || ''}`,
        });
      }
    } catch {}
    setLoadingEpId(null);
  };

  const totalDuration = episodes.reduce((sum: number, ep: any) => sum + (ep.durationSec || 0), 0);

  // novelId 为空时直接显示错误
  if (!novelId) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyText}>剧本 ID 无效</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ ...typography.body, marginTop: 16, color: colors.text.tertiary }}>正在加载剧集...</Text>
          <Text style={{ ...typography.caption, marginTop: 8, color: colors.text.tertiary }}>{loadError || '首次加载可能需要几秒钟'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ListHeaderComponent={
          <>
            {loadError && episodes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🎬</Text>
                <Text style={styles.emptyText}>{loadError}</Text>
              </View>
            ) : null}
            {analysis && (
              <GlassCard padded={true} style={{ margin: spacing.md }}>
                <Text style={styles.analysisTitle}>{novelTitle}</Text>
                {(analysis.genre || analysis.theme || analysis.style) && (
                  <View style={styles.tagRow}>
                    {analysis.genre ? <Tag text={analysis.genre} /> : null}
                    {analysis.theme ? <Tag text={analysis.theme} color="#00CEC9" /> : null}
                    {analysis.style ? <Tag text={analysis.style} color="#E17055" /> : null}
                  </View>
                )}
                {analysis.characters?.length > 0 && (
                  <View style={styles.charSection}>
                    <Text style={styles.sectionLabel}>角色（{analysis.characters.length}个）</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {analysis.characters.map((c: any, i: number) => (
                        <View key={i} style={styles.charChip}>
                          <Text style={styles.charName}>{c.name}</Text>
                          <Text style={styles.charRole}>{c.role_type || 'unknown'}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
                {analysis.plotPoints?.length > 0 && (
                  <View style={styles.plotSection}>
                    <Text style={styles.sectionLabel}>剧情大纲</Text>
                    {analysis.plotPoints.slice(0, 5).map((p: any, i: number) => (
                      <View key={i} style={styles.plotItem}>
                        <Text style={styles.plotBullet}>•</Text>
                        <Text style={styles.plotText}>{p.description}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </GlassCard>
            )}
            {episodes.length > 0 && (
              <View style={styles.episodeHeader}>
                <Text style={styles.episodeHeaderTitle}>剧集列表</Text>
                <Text style={styles.episodeHeaderMeta}>{episodes.length}集 · 总时长 {Math.floor(totalDuration / 60)}分</Text>
              </View>
            )}
          </>
        }
        data={episodes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.episodeCard}
            onPress={() => handleEpisodePress(item)}
            disabled={loadingEpId === item.id}
          >
            <View style={styles.episodeNum}>
              <Text style={styles.episodeNumText}>{item.episodeNumber}</Text>
            </View>
            <View style={styles.episodeInfo}>
              <Text style={styles.episodeTitle} numberOfLines={1}>{item.title || `第${item.episodeNumber}集`}</Text>
              <View style={styles.episodeMetaRow}>
                <Text style={styles.episodeMeta}>{item.durationSec || 3}秒</Text>
                {item.charCount ? <Text style={styles.episodeMeta}>· {item.charCount}字</Text> : null}
                {item.status === 'completed' ? (
                  <Text style={styles.statusCompleted}>✅</Text>
                ) : item.status === 'failed' ? (
                  <Text style={styles.statusFailed}>❌</Text>
                ) : null}
              </View>
              {item.summary ? <Text style={styles.episodeSummary} numberOfLines={1}>{item.summary}</Text> : null}
            </View>
            {loadingEpId === item.id ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.arrow}>›</Text>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={loading ? null : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎬</Text>
            <Text style={styles.emptyText}>{loadError || '暂无剧集数据'}</Text>
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                const epsRes = await getEpisodes(novelId);
                const eps = epsRes.data.data.episodes || [];
                setEpisodes(eps);
                setLoadError(eps.length === 0 ? '该小说暂无剧集数据' : '');
              } catch { setLoadError('加载失败'); }
              setRefreshing(false);
            }}
            tintColor="#6C5CE7"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  list: { paddingBottom: 40 },
  analysisTitle: { ...typography.h2, marginBottom: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  charSection: { marginBottom: spacing.md },
  sectionLabel: { ...typography.h3, color: colors.text.secondary, marginBottom: spacing.sm },
  charChip: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md,
    padding: spacing.sm + 2,
    marginRight: spacing.sm,
    minWidth: 70,
    alignItems: 'center',
  },
  charName: { ...typography.h3, color: colors.text.primary },
  charRole: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },
  plotSection: { marginBottom: spacing.xs },
  plotItem: { flexDirection: 'row', marginBottom: spacing.xs },
  plotBullet: { fontSize: 14, color: colors.accent, marginRight: spacing.sm, marginTop: -1 },
  plotText: { ...typography.body, color: colors.text.secondary, flex: 1 },
  episodeHeader: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  episodeHeaderTitle: { ...typography.h2, color: colors.text.primary },
  episodeHeaderMeta: { ...typography.caption, marginTop: spacing.xs },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm + 2,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  episodeNum: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm + 2,
  },
  episodeNumText: { ...typography.h3, color: colors.text.inverse },
  episodeInfo: { flex: 1 },
  episodeTitle: { ...typography.h3, color: colors.text.primary, marginBottom: 2 },
  episodeMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  episodeMeta: { ...typography.caption, marginRight: spacing.sm },
  statusCompleted: { fontSize: 12 },
  statusFailed: { fontSize: 12 },
  episodeSummary: { ...typography.caption, color: colors.text.tertiary },
  arrow: { fontSize: 24, color: colors.text.tertiary, marginLeft: spacing.sm },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyText: { ...typography.h3, color: colors.text.tertiary },
});
